-- 20260902120100_maestros_activos.sql
-- Maestros de proveedores y repuestos, activos, planes de mantencion y lecturas de uso.
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
create table public.activos (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  codigo_interno text not null,
  patente text,
  numero_serie text,
  numero_chasis text,
  tipo_codigo text not null,
  marca text,
  modelo text,
  anio integer,
  ubicacion text,
  estado estado_activo default 'operativo'::estado_activo not null,
  horometro_actual numeric(12,2),
  kilometraje_actual numeric(12,2),
  fecha_adquisicion date,
  valor_adquisicion numeric(14,2),
  foto_path text,
  qr_token uuid default gen_random_uuid() not null,
  notas text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.lecturas_uso (
  id uuid default gen_random_uuid() not null,
  activo_id uuid not null,
  fecha date default CURRENT_DATE not null,
  horometro numeric(12,2),
  kilometraje numeric(12,2),
  registrado_por uuid,
  created_at timestamp with time zone default now() not null
);

create table public.planes_mantencion (
  id uuid default gen_random_uuid() not null,
  activo_id uuid not null,
  nombre text not null,
  intervalo_dias integer,
  intervalo_horas numeric(10,2),
  descripcion_tareas text,
  activo boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.proveedores (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  rut text,
  giro text,
  contacto_nombre text,
  contacto_email text,
  contacto_telefono text,
  direccion text,
  notas text,
  activo boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.repuestos (
  id uuid default gen_random_uuid() not null,
  codigo text not null,
  nombre text not null,
  descripcion text,
  unidad_medida unidad_medida default 'unidad'::unidad_medida not null,
  stock_actual numeric(14,3) default 0 not null,
  stock_minimo numeric(14,3) default 0 not null,
  costo_unitario_referencia numeric(14,2) default 0 not null,
  proveedor_habitual_id uuid,
  activo boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Constraints
alter table public.activos add constraint activos_pkey PRIMARY KEY (id);
alter table public.lecturas_uso add constraint lecturas_uso_pkey PRIMARY KEY (id);
alter table public.planes_mantencion add constraint planes_mantencion_pkey PRIMARY KEY (id);
alter table public.proveedores add constraint proveedores_pkey PRIMARY KEY (id);
alter table public.repuestos add constraint repuestos_pkey PRIMARY KEY (id);
alter table public.activos add constraint activos_codigo_interno_key UNIQUE (codigo_interno);
alter table public.activos add constraint activos_qr_token_key UNIQUE (qr_token);
alter table public.repuestos add constraint repuestos_codigo_key UNIQUE (codigo);
alter table public.activos add constraint activos_anio_rango CHECK (((anio IS NULL) OR ((anio >= 1900) AND (anio <= 2100))));
alter table public.activos add constraint activos_horometro_no_negativo CHECK (((horometro_actual IS NULL) OR (horometro_actual >= (0)::numeric)));
alter table public.activos add constraint activos_km_no_negativo CHECK (((kilometraje_actual IS NULL) OR (kilometraje_actual >= (0)::numeric)));
alter table public.activos add constraint activos_nombre_no_vacio CHECK ((length(btrim(nombre)) > 0));
alter table public.lecturas_uso add constraint lecturas_al_menos_un_valor CHECK (((horometro IS NOT NULL) OR (kilometraje IS NOT NULL)));
alter table public.lecturas_uso add constraint lecturas_no_negativas CHECK ((((horometro IS NULL) OR (horometro >= (0)::numeric)) AND ((kilometraje IS NULL) OR (kilometraje >= (0)::numeric))));
alter table public.planes_mantencion add constraint planes_al_menos_un_intervalo CHECK (((intervalo_dias IS NOT NULL) OR (intervalo_horas IS NOT NULL)));
alter table public.planes_mantencion add constraint planes_intervalos_positivos CHECK ((((intervalo_dias IS NULL) OR (intervalo_dias > 0)) AND ((intervalo_horas IS NULL) OR (intervalo_horas > (0)::numeric))));
alter table public.planes_mantencion add constraint planes_nombre_no_vacio CHECK ((length(btrim(nombre)) > 0));
alter table public.proveedores add constraint proveedores_email_formato CHECK (((contacto_email IS NULL) OR (contacto_email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'::text)));
alter table public.proveedores add constraint proveedores_nombre_no_vacio CHECK ((length(btrim(nombre)) > 0));
alter table public.proveedores add constraint proveedores_rut_valido CHECK (valida_rut(rut));
alter table public.repuestos add constraint repuestos_codigo_no_vacio CHECK ((length(btrim(codigo)) > 0));
alter table public.repuestos add constraint repuestos_costo_no_negativo CHECK ((costo_unitario_referencia >= (0)::numeric));
alter table public.repuestos add constraint repuestos_stock_minimo_no_negativo CHECK ((stock_minimo >= (0)::numeric));
alter table public.activos add constraint activos_tipo_codigo_fkey FOREIGN KEY (tipo_codigo) REFERENCES tipos_activo(codigo) ON UPDATE CASCADE;
alter table public.lecturas_uso add constraint lecturas_uso_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE CASCADE;
alter table public.lecturas_uso add constraint lecturas_uso_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.planes_mantencion add constraint planes_mantencion_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE CASCADE;
alter table public.repuestos add constraint repuestos_proveedor_habitual_id_fkey FOREIGN KEY (proveedor_habitual_id) REFERENCES proveedores(id) ON DELETE SET NULL;

-- Indices
CREATE INDEX activos_estado_idx ON public.activos USING btree (estado);
CREATE UNIQUE INDEX activos_patente_uk ON public.activos USING btree (patente) WHERE (patente IS NOT NULL);
CREATE INDEX activos_qr_token_idx ON public.activos USING btree (qr_token);
CREATE INDEX activos_tipo_idx ON public.activos USING btree (tipo_codigo);
CREATE INDEX activos_ubicacion_idx ON public.activos USING btree (ubicacion);
CREATE INDEX lecturas_activo_fecha_idx ON public.lecturas_uso USING btree (activo_id, fecha DESC);
CREATE INDEX planes_activo_idx ON public.planes_mantencion USING btree (activo_id) WHERE activo;
CREATE INDEX proveedores_activo_idx ON public.proveedores USING btree (activo);
CREATE UNIQUE INDEX proveedores_rut_uk ON public.proveedores USING btree (rut) WHERE (rut IS NOT NULL);
CREATE INDEX repuestos_bajo_minimo_idx ON public.repuestos USING btree (codigo) WHERE (activo AND (stock_actual <= stock_minimo));
CREATE INDEX repuestos_proveedor_idx ON public.repuestos USING btree (proveedor_habitual_id);

