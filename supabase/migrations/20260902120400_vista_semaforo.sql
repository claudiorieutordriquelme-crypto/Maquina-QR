-- CORRECCION POSTERIOR, IMPORTANTE.
--
-- Estas dos vistas se crearon aca sin la opcion security_invoker. La base de
-- produccion SI la tiene puesta (verificado: security_invoker=on en las dos),
-- asi que no hubo exposicion. El defecto estaba en este archivo, que es el que
-- se aplicaria sobre una base nueva: sin esa opcion, una vista se evalua con
-- los permisos de su DUEÑO y no de quien consulta, o sea se convierte en una
-- puerta lateral que evita las politicas RLS de las tablas que lee.
--
-- Las dos sentencias del final del archivo lo dejan igual que produccion. No se
-- editan los CREATE VIEW de arriba a proposito: este archivo reconstruye lo que
-- ya existe, y un ALTER al final deja constancia de por que esta.

-- 20260902120400_vista_semaforo.sql
-- Vista de tasa de uso y vista del semaforo. Cuando un plan define intervalo por dias y por horas, manda el que venza primero.
--
-- Reconstruido desde el catalogo de la base de produccion (proyecto
-- pnxnvorvuvkodutwordo) porque los archivos de migracion originales se
-- perdieron antes de llegar al repositorio. El registro
-- supabase_migrations.schema_migrations conservo el nombre y el orden de las
-- ocho migraciones, pero no el texto SQL. Las definiciones de funciones,
-- vistas, triggers, constraints e indices vienen textuales de pg_get_*def; las
-- sentencias create table se rearmaron desde pg_attribute. El resultado es
-- equivalente al schema vivo, no identico byte a byte al original.
create view public.v_tasa_uso as
 WITH p AS (
         SELECT parametros_calculo.id,
            parametros_calculo.ventana_tasa_uso_dias,
            parametros_calculo.min_lecturas_tasa,
            parametros_calculo.min_span_tasa_dias,
            parametros_calculo.historial_publico_limite
           FROM parametros_calculo
          WHERE parametros_calculo.id
        ), agg AS (
         SELECT l.activo_id,
            count(*) AS n_lecturas,
            min(l.fecha) AS desde,
            max(l.fecha) AS hasta,
            max(l.horometro) - min(l.horometro) AS delta_horas,
            max(l.fecha) - min(l.fecha) AS span_dias
           FROM lecturas_uso l
             CROSS JOIN p p_1
          WHERE l.horometro IS NOT NULL AND l.fecha >= (CURRENT_DATE - p_1.ventana_tasa_uso_dias)
          GROUP BY l.activo_id
        )
 SELECT a.activo_id,
    a.n_lecturas,
    a.desde,
    a.hasta,
    a.delta_horas,
    a.span_dias,
        CASE
            WHEN a.n_lecturas >= p.min_lecturas_tasa AND a.span_dias >= p.min_span_tasa_dias AND a.delta_horas > 0::numeric THEN round(a.delta_horas / a.span_dias::numeric, 4)
            ELSE NULL::numeric
        END AS horas_por_dia
   FROM agg a
     CROSS JOIN p;

create view public.v_estado_mantencion as
 WITH cfg AS (
         SELECT configuracion.dias_alerta_proxima,
            configuracion.dias_alerta_critica
           FROM configuracion
          WHERE configuracion.id
        ), ultima AS (
         SELECT DISTINCT ON (o.plan_id) o.plan_id,
            o.id AS orden_id,
            o.fecha_ejecucion,
            o.horometro_ejecucion
           FROM ordenes_mantencion o
          WHERE o.plan_id IS NOT NULL AND o.estado = 'completada'::estado_orden AND o.tipo = 'preventiva'::tipo_mantencion AND o.fecha_ejecucion IS NOT NULL
          ORDER BY o.plan_id, o.fecha_ejecucion DESC, o.created_at DESC
        ), primera_lectura AS (
         SELECT DISTINCT ON (l.activo_id) l.activo_id,
            l.horometro AS horometro_inicial
           FROM lecturas_uso l
          WHERE l.horometro IS NOT NULL
          ORDER BY l.activo_id, l.fecha, l.created_at
        ), base AS (
         SELECT pm.id AS plan_id,
            pm.nombre AS plan_nombre,
            pm.intervalo_dias,
            pm.intervalo_horas,
            pm.descripcion_tareas,
            a.id AS activo_id,
            a.nombre AS activo_nombre,
            a.codigo_interno,
            a.estado AS activo_estado,
            a.ubicacion,
            a.horometro_actual,
            u.orden_id AS ultima_orden_id,
            u.fecha_ejecucion AS ultima_ejecucion,
            u.horometro_ejecucion AS horometro_ultima_ejecucion,
            COALESCE(u.fecha_ejecucion, a.fecha_adquisicion) AS base_fecha,
            COALESCE(u.horometro_ejecucion, pl.horometro_inicial) AS base_horas,
            t.horas_por_dia,
            c.dias_alerta_proxima,
            c.dias_alerta_critica
           FROM planes_mantencion pm
             JOIN activos a ON a.id = pm.activo_id
             LEFT JOIN ultima u ON u.plan_id = pm.id
             LEFT JOIN primera_lectura pl ON pl.activo_id = a.id
             LEFT JOIN v_tasa_uso t ON t.activo_id = a.id
             CROSS JOIN cfg c
          WHERE pm.activo AND a.estado <> 'dado_de_baja'::estado_activo
        ), calc AS (
         SELECT b.plan_id,
            b.plan_nombre,
            b.intervalo_dias,
            b.intervalo_horas,
            b.descripcion_tareas,
            b.activo_id,
            b.activo_nombre,
            b.codigo_interno,
            b.activo_estado,
            b.ubicacion,
            b.horometro_actual,
            b.ultima_orden_id,
            b.ultima_ejecucion,
            b.horometro_ultima_ejecucion,
            b.base_fecha,
            b.base_horas,
            b.horas_por_dia,
            b.dias_alerta_proxima,
            b.dias_alerta_critica,
                CASE
                    WHEN b.intervalo_dias IS NOT NULL AND b.base_fecha IS NOT NULL THEN b.base_fecha + b.intervalo_dias
                    ELSE NULL::date
                END AS proxima_por_fecha,
                CASE
                    WHEN b.intervalo_horas IS NOT NULL AND b.base_horas IS NOT NULL THEN b.base_horas + b.intervalo_horas
                    ELSE NULL::numeric
                END AS umbral_horas,
                CASE
                    WHEN b.intervalo_horas IS NOT NULL AND b.base_horas IS NOT NULL AND b.horometro_actual IS NOT NULL THEN round(b.base_horas + b.intervalo_horas - b.horometro_actual, 2)
                    ELSE NULL::numeric
                END AS horas_restantes
           FROM base b
        ), proy AS (
         SELECT c.plan_id,
            c.plan_nombre,
            c.intervalo_dias,
            c.intervalo_horas,
            c.descripcion_tareas,
            c.activo_id,
            c.activo_nombre,
            c.codigo_interno,
            c.activo_estado,
            c.ubicacion,
            c.horometro_actual,
            c.ultima_orden_id,
            c.ultima_ejecucion,
            c.horometro_ultima_ejecucion,
            c.base_fecha,
            c.base_horas,
            c.horas_por_dia,
            c.dias_alerta_proxima,
            c.dias_alerta_critica,
            c.proxima_por_fecha,
            c.umbral_horas,
            c.horas_restantes,
            c.proxima_por_fecha - CURRENT_DATE AS dias_restantes_fecha,
                CASE
                    WHEN c.horas_restantes IS NULL THEN NULL::integer
                    WHEN c.horas_restantes <= 0::numeric THEN 0
                    WHEN c.horas_por_dia IS NULL OR c.horas_por_dia <= 0::numeric THEN NULL::integer
                    ELSE ceil(c.horas_restantes / c.horas_por_dia)::integer
                END AS dias_restantes_horas
           FROM calc c
        )
 SELECT activo_id,
    activo_nombre,
    codigo_interno,
    activo_estado,
    ubicacion,
    plan_id,
    plan_nombre,
    descripcion_tareas,
    intervalo_dias,
    intervalo_horas,
    ultima_orden_id,
    ultima_ejecucion,
    horometro_ultima_ejecucion,
    horometro_actual,
    base_fecha,
    base_horas,
    horas_por_dia AS tasa_uso_horas_dia,
    proxima_por_fecha,
    umbral_horas,
    horas_restantes,
    dias_restantes_fecha,
    dias_restantes_horas,
        CASE
            WHEN dias_restantes_fecha IS NULL AND dias_restantes_horas IS NULL THEN NULL::disparador_mantencion
            WHEN dias_restantes_horas IS NULL THEN 'fecha'::disparador_mantencion
            WHEN dias_restantes_fecha IS NULL THEN 'horas'::disparador_mantencion
            WHEN dias_restantes_horas < dias_restantes_fecha THEN 'horas'::disparador_mantencion
            ELSE 'fecha'::disparador_mantencion
        END AS disparador,
    LEAST(dias_restantes_fecha, dias_restantes_horas) AS dias_restantes,
        CASE
            WHEN dias_restantes_fecha IS NULL AND dias_restantes_horas IS NULL THEN NULL::date
            WHEN dias_restantes_horas IS NULL THEN proxima_por_fecha
            WHEN dias_restantes_fecha IS NULL THEN CURRENT_DATE + dias_restantes_horas
            WHEN dias_restantes_horas < dias_restantes_fecha THEN CURRENT_DATE + dias_restantes_horas
            ELSE proxima_por_fecha
        END AS proxima_fecha,
        CASE
            WHEN dias_restantes_fecha IS NOT NULL AND dias_restantes_fecha < 0 OR horas_restantes IS NOT NULL AND horas_restantes <= 0::numeric THEN 'vencida'::semaforo_mantencion
            WHEN dias_restantes_fecha IS NULL AND dias_restantes_horas IS NULL THEN 'sin_linea_base'::semaforo_mantencion
            WHEN LEAST(dias_restantes_fecha, dias_restantes_horas) <= dias_alerta_critica THEN 'critica'::semaforo_mantencion
            WHEN LEAST(dias_restantes_fecha, dias_restantes_horas) <= dias_alerta_proxima THEN 'proxima'::semaforo_mantencion
            ELSE 'al_dia'::semaforo_mantencion
        END AS semaforo
   FROM proy p;

-- security_invoker: la vista aplica el RLS de QUIEN CONSULTA y no el de su
-- dueño. Sin esto, una cuenta deshabilitada con token vigente podria leer
-- activos, planes y ordenes a traves de la vista, porque puede_leer() ya
-- devuelve false pero el dueño de la vista sigue teniendo acceso a las tablas.
alter view public.v_estado_mantencion set (security_invoker = on);
alter view public.v_tasa_uso set (security_invoker = on);
