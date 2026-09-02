-- 20260902120500_ficha_publica.sql
-- Superficie publica: rate limit y la unica funcion que el rol anon puede ejecutar.
--
-- Reconstruido desde el catalogo de la base de produccion (proyecto
-- pnxnvorvuvkodutwordo) porque los archivos de migracion originales se
-- perdieron antes de llegar al repositorio. El registro
-- supabase_migrations.schema_migrations conservo el nombre y el orden de las
-- ocho migraciones, pero no el texto SQL. Las definiciones de funciones,
-- vistas, triggers, constraints e indices vienen textuales de pg_get_*def; las
-- sentencias create table se rearmaron desde pg_attribute. El resultado es
-- equivalente al schema vivo, no identico byte a byte al original.
-- Tablas
create table public.rate_limit_publico (
  clave text not null,
  ventana timestamp with time zone not null,
  hits integer default 0 not null
);

-- Constraints
alter table public.rate_limit_publico add constraint rate_limit_publico_pkey PRIMARY KEY (clave, ventana);

-- Indices
CREATE INDEX rate_limit_ventana_idx ON public.rate_limit_publico USING btree (ventana);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_clave text, p_max_hits integer DEFAULT 60, p_ventana_seg integer DEFAULT 60)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ventana timestamptz;
  v_hits    int;
begin
  if p_clave is null or length(btrim(p_clave)) = 0 then
    return true;  -- sin clave utilizable no se penaliza al usuario legitimo
  end if;

  v_ventana := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_ventana_seg) * p_ventana_seg);

  insert into public.rate_limit_publico (clave, ventana, hits)
  values (p_clave, v_ventana, 1)
  on conflict (clave, ventana)
    do update set hits = public.rate_limit_publico.hits + 1
  returning hits into v_hits;

  return v_hits <= p_max_hits;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_ficha_publica(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_activo        public.activos;
  v_tipo_nombre   text;
  v_mostrar       boolean;
  v_limite        int;
  v_resultado     jsonb;
  v_estado        jsonb;
  v_historial     jsonb;
begin
  if p_token is null then
    return null;
  end if;

  select * into v_activo
  from public.activos a
  where a.qr_token = p_token
  limit 1;

  if not found then
    return null;
  end if;

  -- Un activo dado de baja no expone ficha: responde igual que un token inexistente.
  if v_activo.estado = 'dado_de_baja' then
    return null;
  end if;

  select ta.nombre into v_tipo_nombre
  from public.tipos_activo ta
  where ta.codigo = v_activo.tipo_codigo;

  select c.mostrar_costos_publico into v_mostrar
  from public.configuracion c
  where c.id;

  select pc.historial_publico_limite into v_limite
  from public.parametros_calculo pc
  where pc.id;

  v_mostrar := coalesce(v_mostrar, false);
  v_limite  := coalesce(v_limite, 50);

  -- Estado de mantencion por plan
  select coalesce(jsonb_agg(x order by x_orden, x_dias nulls last), '[]'::jsonb)
    into v_estado
  from (
    select
      jsonb_build_object(
        'plan',            em.plan_nombre,
        'proxima_fecha',   em.proxima_fecha,
        'semaforo',        em.semaforo,
        'dias_restantes',  em.dias_restantes,
        'disparador',      em.disparador,
        'horas_restantes', em.horas_restantes
      ) as x,
      case em.semaforo
        when 'vencida'        then 1
        when 'critica'        then 2
        when 'proxima'        then 3
        when 'al_dia'         then 4
        else 5
      end as x_orden,
      em.dias_restantes as x_dias
    from public.v_estado_mantencion em
    where em.activo_id = v_activo.id
  ) s;

  -- Historial de ordenes completadas
  select coalesce(jsonb_agg(h order by h_fecha desc), '[]'::jsonb)
    into v_historial
  from (
    select
      (
        jsonb_build_object(
          'folio',               o.folio,
          'fecha_ejecucion',     o.fecha_ejecucion,
          'tipo',                o.tipo,
          'descripcion_trabajo', o.descripcion_trabajo,
          'causa_falla',         o.causa_falla,
          'horometro_ejecucion', o.horometro_ejecucion,
          'ejecutor',            case when v_mostrar then coalesce(pr.nombre, o.ejecutor_interno)
                                      else case when o.proveedor_id is not null
                                                then 'Servicio externo'
                                                else coalesce(o.ejecutor_interno, 'Interno') end
                                 end,
          'repuestos', coalesce((
            select jsonb_agg(
                     jsonb_build_object(
                       'descripcion', coalesce(rp.nombre, l.descripcion_libre),
                       'cantidad',    l.cantidad,
                       'unidad',      rp.unidad_medida
                     ) || case when v_mostrar
                               then jsonb_build_object('subtotal', l.subtotal)
                               else '{}'::jsonb end
                     order by coalesce(rp.nombre, l.descripcion_libre)
                   )
            from public.orden_repuestos l
            left join public.repuestos rp on rp.id = l.repuesto_id
            where l.orden_id = o.id
          ), '[]'::jsonb)
        )
        ||
        case when v_mostrar
             then jsonb_build_object(
                    'proveedor',      pr.nombre,
                    'numero_factura', o.numero_factura,
                    'costo_total',    o.costo_total,
                    'monto_mano_obra', o.monto_mano_obra,
                    'monto_repuestos', o.monto_repuestos,
                    'monto_otros',     o.monto_otros
                  )
             else '{}'::jsonb
        end
      ) as h,
      o.fecha_ejecucion as h_fecha
    from public.ordenes_mantencion o
    left join public.proveedores pr on pr.id = o.proveedor_id
    where o.activo_id = v_activo.id
      and o.estado = 'completada'
      and o.fecha_ejecucion is not null
    order by o.fecha_ejecucion desc, o.created_at desc
    limit v_limite
  ) t;

  v_resultado := jsonb_build_object(
    'activo', jsonb_build_object(
      'nombre',             v_activo.nombre,
      'codigo_interno',     v_activo.codigo_interno,
      'patente',            v_activo.patente,
      'tipo_codigo',        v_activo.tipo_codigo,
      'tipo',               v_tipo_nombre,
      'marca',              v_activo.marca,
      'modelo',             v_activo.modelo,
      'anio',               v_activo.anio,
      'ubicacion',          v_activo.ubicacion,
      'estado',             v_activo.estado,
      'horometro_actual',   v_activo.horometro_actual,
      'kilometraje_actual', v_activo.kilometraje_actual,
      'foto_path',          v_activo.foto_path
    ),
    'estado_mantencion', v_estado,
    'historial',         v_historial,
    'muestra_costos',    v_mostrar,
    'generado_en',       now()
  );

  return v_resultado;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.purga_rate_limit(p_antiguedad interval DEFAULT '01:00:00'::interval)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_borradas int;
begin
  delete from public.rate_limit_publico
  where ventana < clock_timestamp() - p_antiguedad;
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$function$
;

