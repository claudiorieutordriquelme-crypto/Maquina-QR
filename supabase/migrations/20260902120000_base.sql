-- 20260902120000_base.sql
-- Tipos enumerados, helpers de rol y de RUT, tablas de configuracion y perfiles.
--
-- Reconstruido desde el catalogo de la base de produccion (proyecto
-- pnxnvorvuvkodutwordo) porque los archivos de migracion originales se
-- perdieron antes de llegar al repositorio. El registro
-- supabase_migrations.schema_migrations conservo el nombre y el orden de las
-- ocho migraciones, pero no el texto SQL. Las definiciones de funciones,
-- vistas, triggers, constraints e indices vienen textuales de pg_get_*def; las
-- sentencias create table se rearmaron desde pg_attribute. El resultado es
-- equivalente al schema vivo, no identico byte a byte al original.
-- Tipos enumerados
create type public.disparador_mantencion as enum ('fecha', 'horas');
create type public.entidad_documento as enum ('activo', 'orden');
create type public.estado_activo as enum ('operativo', 'en_mantencion', 'fuera_servicio', 'dado_de_baja');
create type public.estado_orden as enum ('programada', 'en_ejecucion', 'completada', 'anulada');
create type public.rol_usuario as enum ('admin', 'tecnico', 'lector');
create type public.semaforo_mantencion as enum ('vencida', 'critica', 'proxima', 'al_dia', 'sin_linea_base');
create type public.tipo_documento as enum ('factura', 'boleta', 'orden_compra', 'manual', 'foto', 'otro');
create type public.tipo_mantencion as enum ('preventiva', 'correctiva', 'predictiva');
create type public.tipo_movimiento_stock as enum ('ingreso', 'consumo', 'ajuste');
create type public.unidad_medida as enum ('unidad', 'litro', 'kilo', 'metro', 'juego');

-- Tablas
create table public.configuracion (
  id boolean default true not null,
  mostrar_costos_publico boolean default false not null,
  dias_alerta_proxima integer default 30 not null,
  dias_alerta_critica integer default 7 not null,
  moneda text default 'CLP'::text not null,
  nombre_organizacion text default ''::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.parametros_calculo (
  id boolean default true not null,
  ventana_tasa_uso_dias integer default 180 not null,
  min_lecturas_tasa integer default 2 not null,
  min_span_tasa_dias integer default 7 not null,
  historial_publico_limite integer default 50 not null
);

create table public.profiles (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  nombre text default ''::text not null,
  email text,
  rol rol_usuario default 'lector'::rol_usuario not null,
  activo boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.tipos_activo (
  codigo text not null,
  nombre text not null,
  orden integer default 100 not null,
  activo boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Constraints
alter table public.configuracion add constraint configuracion_pkey PRIMARY KEY (id);
alter table public.parametros_calculo add constraint parametros_calculo_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.tipos_activo add constraint tipos_activo_pkey PRIMARY KEY (codigo);
alter table public.profiles add constraint profiles_user_id_key UNIQUE (user_id);
alter table public.configuracion add constraint configuracion_singleton CHECK (id);
alter table public.configuracion add constraint configuracion_umbrales CHECK (((dias_alerta_critica >= 0) AND (dias_alerta_proxima > dias_alerta_critica)));
alter table public.parametros_calculo add constraint parametros_rangos CHECK ((((ventana_tasa_uso_dias >= 30) AND (ventana_tasa_uso_dias <= 1095)) AND (min_lecturas_tasa >= 2) AND (min_span_tasa_dias >= 1) AND ((historial_publico_limite >= 1) AND (historial_publico_limite <= 500))));
alter table public.parametros_calculo add constraint parametros_singleton CHECK (id);
alter table public.tipos_activo add constraint tipos_activo_codigo_slug CHECK ((codigo ~ '^[a-z0-9_]+$'::text));
alter table public.profiles add constraint profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Indices
CREATE INDEX profiles_rol_idx ON public.profiles USING btree (rol) WHERE activo;

-- Helpers de rol y de RUT
CREATE OR REPLACE FUNCTION public.normaliza_rut(p_rut text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_rut is null then null
    else left(upper(regexp_replace(p_rut, '[^0-9kK]', '', 'g')),
              length(upper(regexp_replace(p_rut, '[^0-9kK]', '', 'g'))) - 1)
         || '-' ||
         right(upper(regexp_replace(p_rut, '[^0-9kK]', '', 'g')), 1)
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.valida_rut(p_rut text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_limpio  text;
  v_cuerpo  text;
  v_dv      text;
  v_suma    int := 0;
  v_mult    int := 2;
  v_resto   int;
  v_esperado text;
  i         int;
begin
  if p_rut is null then
    return true;  -- la nulidad se controla con NOT NULL, no aca
  end if;

  -- Normaliza: quita puntos, guiones y espacios; mayusculiza la K
  v_limpio := upper(regexp_replace(p_rut, '[^0-9kK]', '', 'g'));

  if length(v_limpio) < 8 or length(v_limpio) > 9 then
    return false;
  end if;

  v_cuerpo := left(v_limpio, length(v_limpio) - 1);
  v_dv     := right(v_limpio, 1);

  if v_cuerpo !~ '^[0-9]+$' then
    return false;
  end if;

  -- Modulo 11 recorriendo el cuerpo de derecha a izquierda
  for i in reverse length(v_cuerpo)..1 loop
    v_suma := v_suma + (substr(v_cuerpo, i, 1))::int * v_mult;
    v_mult := case when v_mult = 7 then 2 else v_mult + 1 end;
  end loop;

  v_resto := 11 - (v_suma % 11);
  v_esperado := case
                  when v_resto = 11 then '0'
                  when v_resto = 10 then 'K'
                  else v_resto::text
                end;

  return v_dv = v_esperado;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mi_profile_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.activo
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.mi_rol()
 RETURNS rol_usuario
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.rol
  from public.profiles p
  where p.user_id = auth.uid()
    and p.activo
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.es_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select public.mi_rol() = 'admin';
$function$
;

CREATE OR REPLACE FUNCTION public.puede_leer()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select public.mi_rol() in ('admin', 'tecnico', 'lector');
$function$
;

CREATE OR REPLACE FUNCTION public.puede_operar()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select public.mi_rol() in ('admin', 'tecnico');
$function$
;

CREATE OR REPLACE FUNCTION public.tg_handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (user_id, nombre, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1), ''),
    new.email,
    'lector'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$function$
;

-- Puente con auth.users
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION tg_handle_new_user();

