-- 20260902120300_triggers_negocio.sql
-- Funciones de trigger de negocio y su cableado. Son SECURITY DEFINER a proposito: un tecnico no puede hacer UPDATE de activos ni de repuestos, pero el trigger que sincroniza horometro y stock si debe poder. Pasarlas a SECURITY INVOKER rompe el registro de ordenes con violacion de RLS.
--
-- Reconstruido desde el catalogo de la base de produccion (proyecto
-- pnxnvorvuvkodutwordo) porque los archivos de migracion originales se
-- perdieron antes de llegar al repositorio. El registro
-- supabase_migrations.schema_migrations conservo el nombre y el orden de las
-- ocho migraciones, pero no el texto SQL. Las definiciones de funciones,
-- vistas, triggers, constraints e indices vienen textuales de pg_get_*def; las
-- sentencias create table se rearmaron desde pg_attribute. El resultado es
-- equivalente al schema vivo, no identico byte a byte al original.
CREATE OR REPLACE FUNCTION public.tg_anula_orden_revierte_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
begin
  if new.estado = 'anulada' and old.estado <> 'anulada' then
    for r in
      select m.repuesto_id, sum(m.cantidad) as saldo
      from public.movimientos_stock m
      where m.orden_id = new.id
      group by m.repuesto_id
      having sum(m.cantidad) <> 0
    loop
      insert into public.movimientos_stock (repuesto_id, tipo, cantidad, orden_id, motivo)
      values (r.repuesto_id, 'ajuste', -r.saldo, new.id,
              'Reversa por anulacion de orden');
    end loop;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_aplica_movimiento_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.repuestos r
     set stock_actual = coalesce((
           select sum(m.cantidad)
           from public.movimientos_stock m
           where m.repuesto_id = r.id
         ), 0)
   where r.id = coalesce(new.repuesto_id, old.repuesto_id);

  return coalesce(new, old);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_consumo_desde_linea()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_consumido numeric(14,3);
  v_delta     numeric(14,3);
  v_repuesto  uuid;
begin
  -- Cambio de repuesto en la linea: se revierte lo consumido del anterior
  -- y se trata como una linea nueva del repuesto entrante.
  if tg_op = 'UPDATE' and old.repuesto_id is distinct from new.repuesto_id
     and old.repuesto_id is not null then
    select coalesce(sum(m.cantidad), 0) into v_consumido
    from public.movimientos_stock m
    where m.linea_id = old.id and m.repuesto_id = old.repuesto_id;

    if v_consumido <> 0 then
      insert into public.movimientos_stock (repuesto_id, tipo, cantidad, orden_id, linea_id, motivo)
      values (old.repuesto_id, 'ajuste', -v_consumido, old.orden_id, old.id,
              'Reversa por cambio de repuesto en la linea');
    end if;
  end if;

  if tg_op = 'DELETE' then
    v_repuesto := old.repuesto_id;
  else
    v_repuesto := new.repuesto_id;
  end if;

  -- Repuesto fuera del maestro (descripcion_libre): no mueve inventario.
  if v_repuesto is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(m.cantidad), 0) into v_consumido
  from public.movimientos_stock m
  where m.linea_id = coalesce(new.id, old.id)
    and m.repuesto_id = v_repuesto;

  if tg_op = 'DELETE' then
    -- Reversa completa, sin borrar el movimiento original.
    if v_consumido <> 0 then
      insert into public.movimientos_stock (repuesto_id, tipo, cantidad, orden_id, linea_id, motivo)
      values (v_repuesto, 'ajuste', -v_consumido, old.orden_id, old.id,
              'Reversa por eliminacion de linea de repuesto');
    end if;
    return old;
  end if;

  -- El consumo esperado es negativo. v_delta es lo que falta por mover.
  v_delta := (-new.cantidad) - v_consumido;

  if v_delta <> 0 then
    insert into public.movimientos_stock (repuesto_id, tipo, cantidad, orden_id, linea_id, motivo)
    values (
      v_repuesto,
      (case when v_consumido = 0 then 'consumo' else 'ajuste' end)::public.tipo_movimiento_stock,
      v_delta,
      new.orden_id,
      new.id,
      case when v_consumido = 0
           then 'Consumo por orden de mantencion'
           else 'Ajuste por correccion de cantidad en la linea' end
    );
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_normaliza_activo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.patente is not null then
    new.patente := upper(regexp_replace(new.patente, '[^A-Za-z0-9]', '', 'g'));
    if length(new.patente) = 0 then
      new.patente := null;
    end if;
  end if;
  new.codigo_interno := upper(btrim(new.codigo_interno));
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_normaliza_rut_proveedor()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.rut := public.normaliza_rut(new.rut);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_orden_genera_lectura()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.estado = 'completada'
     and new.fecha_ejecucion is not null
     and (new.horometro_ejecucion is not null or new.kilometraje_ejecucion is not null)
  then
    if not exists (
      select 1 from public.lecturas_uso l
      where l.activo_id = new.activo_id
        and l.fecha     = new.fecha_ejecucion
        and coalesce(l.horometro,   -1) = coalesce(new.horometro_ejecucion,   -1)
        and coalesce(l.kilometraje, -1) = coalesce(new.kilometraje_ejecucion, -1)
    ) then
      insert into public.lecturas_uso (activo_id, fecha, horometro, kilometraje, registrado_por)
      values (new.activo_id, new.fecha_ejecucion,
              new.horometro_ejecucion, new.kilometraje_ejecucion, new.creado_por);
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_recalcula_monto_repuestos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_orden_id uuid;
begin
  v_orden_id := coalesce(new.orden_id, old.orden_id);

  update public.ordenes_mantencion o
     set monto_repuestos = coalesce((
           select sum(l.subtotal)
           from public.orden_repuestos l
           where l.orden_id = v_orden_id
         ), 0)
   where o.id = v_orden_id;

  return coalesce(new, old);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_sincroniza_lectura_activo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_activo uuid;
  v_hor    numeric(12,2);
  v_km     numeric(12,2);
begin
  v_activo := coalesce(new.activo_id, old.activo_id);

  select l.horometro into v_hor
  from public.lecturas_uso l
  where l.activo_id = v_activo and l.horometro is not null
  order by l.fecha desc, l.created_at desc
  limit 1;

  select l.kilometraje into v_km
  from public.lecturas_uso l
  where l.activo_id = v_activo and l.kilometraje is not null
  order by l.fecha desc, l.created_at desc
  limit 1;

  update public.activos a
     set horometro_actual   = coalesce(v_hor, a.horometro_actual),
         kilometraje_actual = coalesce(v_km,  a.kilometraje_actual)
   where a.id = v_activo;

  return coalesce(new, old);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_valida_entidad_documento()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.entidad_tipo = 'activo' then
    if not exists (select 1 from public.activos a where a.id = new.entidad_id) then
      raise exception 'El activo % no existe', new.entidad_id using errcode = '23503';
    end if;
  elsif new.entidad_tipo = 'orden' then
    if not exists (select 1 from public.ordenes_mantencion o where o.id = new.entidad_id) then
      raise exception 'La orden % no existe', new.entidad_id using errcode = '23503';
    end if;
  end if;
  return new;
end;
$function$
;

-- Triggers
CREATE TRIGGER activos_normaliza BEFORE INSERT OR UPDATE OF patente, codigo_interno ON public.activos FOR EACH ROW EXECUTE FUNCTION tg_normaliza_activo();
CREATE TRIGGER activos_set_updated_at BEFORE UPDATE ON public.activos FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER configuracion_set_updated_at BEFORE UPDATE ON public.configuracion FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER documentos_set_updated_at BEFORE UPDATE ON public.documentos FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER documentos_valida_entidad BEFORE INSERT OR UPDATE OF entidad_tipo, entidad_id ON public.documentos FOR EACH ROW EXECUTE FUNCTION tg_valida_entidad_documento();
CREATE TRIGGER lecturas_uso_sincroniza AFTER INSERT OR DELETE OR UPDATE ON public.lecturas_uso FOR EACH ROW EXECUTE FUNCTION tg_sincroniza_lectura_activo();
CREATE TRIGGER movimientos_stock_aplica AFTER INSERT OR DELETE OR UPDATE ON public.movimientos_stock FOR EACH ROW EXECUTE FUNCTION tg_aplica_movimiento_stock();
CREATE TRIGGER orden_repuestos_consumo AFTER INSERT OR DELETE OR UPDATE OF repuesto_id, cantidad ON public.orden_repuestos FOR EACH ROW EXECUTE FUNCTION tg_consumo_desde_linea();
CREATE TRIGGER orden_repuestos_recalcula_monto AFTER INSERT OR DELETE OR UPDATE ON public.orden_repuestos FOR EACH ROW EXECUTE FUNCTION tg_recalcula_monto_repuestos();
CREATE TRIGGER orden_repuestos_set_updated_at BEFORE UPDATE ON public.orden_repuestos FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER ordenes_anula_revierte_stock AFTER UPDATE OF estado ON public.ordenes_mantencion FOR EACH ROW EXECUTE FUNCTION tg_anula_orden_revierte_stock();
CREATE TRIGGER ordenes_genera_lectura AFTER INSERT OR UPDATE OF estado, fecha_ejecucion, horometro_ejecucion, kilometraje_ejecucion ON public.ordenes_mantencion FOR EACH ROW EXECUTE FUNCTION tg_orden_genera_lectura();
CREATE TRIGGER ordenes_set_updated_at BEFORE UPDATE ON public.ordenes_mantencion FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER planes_set_updated_at BEFORE UPDATE ON public.planes_mantencion FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER proveedores_normaliza_rut BEFORE INSERT OR UPDATE OF rut ON public.proveedores FOR EACH ROW EXECUTE FUNCTION tg_normaliza_rut_proveedor();
CREATE TRIGGER proveedores_set_updated_at BEFORE UPDATE ON public.proveedores FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER repuestos_set_updated_at BEFORE UPDATE ON public.repuestos FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER tipos_activo_set_updated_at BEFORE UPDATE ON public.tipos_activo FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

