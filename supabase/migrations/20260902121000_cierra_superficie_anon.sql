-- 20260902121000_cierra_superficie_anon.sql
-- Cierra la superficie ejecutable del rol anon y mueve el rate limit adentro
-- de la funcion publica.
--
-- El problema que resuelve: en el schema public habia 21 funciones y anon podia
-- ejecutar las 21. No porque alguien lo pidiera, sino porque Postgres otorga
-- EXECUTE al pseudo-rol PUBLIC en cada funcion nueva, exactamente el mismo tipo
-- de exposicion por defecto que ya estaba resuelto para tablas. Consecuencias
-- concretas medidas sobre la base de produccion:
--
--   1. purga_rate_limit() es SECURITY DEFINER y borra rate_limit_publico, asi
--      que cualquiera sin autenticarse dejaba el rate limiting en cero.
--   2. consume_rate_limit() era llamable directo, lo que permite inflar el
--      contador de la clave de otra persona y dejarla fuera.
--   3. get_ficha_publica() era llamable directo por /rest/v1/rpc, saltandose la
--      ruta de la aplicacion donde vivia el rate limit.
--
-- Atenuante, para no sobredimensionar: qr_token es un UUID v4, 122 bits de
-- entropia. Enumerarlo no es viable ni sin rate limit. El limite es defensa en
-- profundidad; purga_rate_limit abierta a anon no tenia ninguna justificacion.

-- El rate limit pasa a ejecutarse dentro de la funcion publica y no en la ruta.
-- La alternativa era contarlo desde el servidor con un cliente privilegiado,
-- pero eso obliga a cargar SUPABASE_SERVICE_ROLE_KEY en la ruta mas expuesta de
-- la aplicacion, y hasta la Etapa 7 ningun camino de ejecucion la necesita.
-- Adentro no hace falta ningun grant extra: get_ficha_publica es SECURITY
-- DEFINER, asi que cuando llama a consume_rate_limit el chequeo de permisos se
-- hace contra el dueno de la funcion, no contra anon.
--
-- Limite honesto de este control: la clave la provee quien llama. Un atacante
-- que pegue directo al RPC puede rotarla y saltarse el conteo. El unico punto
-- donde el limite se puede imponer de verdad es el borde, con la IP real. Esto
-- frena abuso volumetrico casual, no a alguien decidido.
--
-- Cambia la firma: la funcion pasa de (uuid) a (uuid, text) y deja de ser
-- STABLE, porque una funcion no volatil no puede escribir y el contador es una
-- escritura. Se dropea la version de un argumento para no dejar dos overloads,
-- que harian ambigua toda llamada con un solo parametro.
drop function if exists public.get_ficha_publica(uuid);

create or replace function public.get_ficha_publica(p_token uuid, p_clave text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
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

  -- 60 llamadas por minuto y por clave. Con clave nula no se penaliza: la ruta
  -- puede no tener una IP utilizable y un usuario legitimo no debe pagar por eso.
  if p_clave is not null and not public.consume_rate_limit(p_clave, 60, 60) then
    return jsonb_build_object('error', 'rate_limit');
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
$function$;

-- Revocar desde anon a secas NO sirve: el privilegio no lo tiene anon en
-- particular, lo tiene el pseudo-rol PUBLIC, y PUBLIC alcanza a todos los roles.
-- Hay que revocar desde PUBLIC y despues devolver explicitamente lo que si
-- corresponde. Se revoca tambien desde anon por si en algun momento se le dio
-- un grant nominativo.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- authenticated y service_role recuperan lo que tenian. No es cosmetico: las
-- politicas RLS se evaluan con los privilegios de quien consulta, asi que si
-- authenticated pierde EXECUTE sobre mi_rol, es_admin, puede_leer o
-- puede_operar, toda politica que las use falla con permission denied y el
-- panel privado deja de funcionar por completo.
grant execute on all functions in schema public to authenticated;
grant execute on all functions in schema public to service_role;

-- La unica puerta de anon.
grant execute on function public.get_ficha_publica(uuid, text) to anon;

-- Para que una funcion futura no vuelva a quedar expuesta por defecto.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public grant execute on functions to authenticated;
alter default privileges in schema public grant execute on functions to service_role;
