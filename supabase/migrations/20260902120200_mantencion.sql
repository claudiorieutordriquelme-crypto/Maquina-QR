-- 20260902120200_mantencion.sql
-- Ordenes de mantencion, lineas de repuestos, movimientos de stock y documentos.
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
create table public.documentos (
  id uuid default gen_random_uuid() not null,
  entidad_tipo entidad_documento not null,
  entidad_id uuid not null,
  tipo_documento tipo_documento default 'otro'::tipo_documento not null,
  nombre_archivo text not null,
  storage_path text not null,
  bucket text default 'documentos'::text not null,
  mime_type text,
  tamano_bytes bigint,
  subido_por uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.movimientos_stock (
  id uuid default gen_random_uuid() not null,
  repuesto_id uuid not null,
  tipo tipo_movimiento_stock not null,
  cantidad numeric(14,3) not null,
  orden_id uuid,
  linea_id uuid,
  motivo text,
  creado_por uuid,
  created_at timestamp with time zone default now() not null
);

create table public.orden_repuestos (
  id uuid default gen_random_uuid() not null,
  orden_id uuid not null,
  repuesto_id uuid,
  descripcion_libre text,
  cantidad numeric(14,3) not null,
  costo_unitario numeric(14,2) default 0 not null,
  subtotal numeric(14,2) generated always as (round((cantidad * costo_unitario), 2)) stored,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.ordenes_mantencion (
  id uuid default gen_random_uuid() not null,
  folio bigint not null,
  activo_id uuid not null,
  plan_id uuid,
  tipo tipo_mantencion not null,
  estado estado_orden default 'programada'::estado_orden not null,
  fecha_programada date,
  fecha_ejecucion date,
  horometro_ejecucion numeric(12,2),
  kilometraje_ejecucion numeric(12,2),
  descripcion_trabajo text default ''::text not null,
  causa_falla text,
  proveedor_id uuid,
  ejecutor_interno text,
  numero_factura text,
  fecha_factura date,
  monto_mano_obra numeric(14,2) default 0 not null,
  monto_repuestos numeric(14,2) default 0 not null,
  monto_otros numeric(14,2) default 0 not null,
  costo_total numeric(14,2) generated always as (((COALESCE(monto_mano_obra, (0)::numeric) + COALESCE(monto_repuestos, (0)::numeric)) + COALESCE(monto_otros, (0)::numeric))) stored,
  tiempo_fuera_servicio_horas numeric(10,2),
  creado_por uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Constraints
alter table public.documentos add constraint documentos_pkey PRIMARY KEY (id);
alter table public.movimientos_stock add constraint movimientos_stock_pkey PRIMARY KEY (id);
alter table public.orden_repuestos add constraint orden_repuestos_pkey PRIMARY KEY (id);
alter table public.ordenes_mantencion add constraint ordenes_mantencion_pkey PRIMARY KEY (id);
alter table public.documentos add constraint documentos_storage_path_key UNIQUE (storage_path);
alter table public.documentos add constraint documentos_tamano_no_negativo CHECK (((tamano_bytes IS NULL) OR (tamano_bytes >= 0)));
alter table public.movimientos_stock add constraint movimientos_cantidad_no_cero CHECK ((cantidad <> (0)::numeric));
alter table public.movimientos_stock add constraint movimientos_signo_coherente CHECK ((((tipo = 'ingreso'::tipo_movimiento_stock) AND (cantidad > (0)::numeric)) OR ((tipo = 'consumo'::tipo_movimiento_stock) AND (cantidad < (0)::numeric)) OR (tipo = 'ajuste'::tipo_movimiento_stock)));
alter table public.orden_repuestos add constraint orden_repuestos_cantidad_positiva CHECK ((cantidad > (0)::numeric));
alter table public.orden_repuestos add constraint orden_repuestos_costo_no_negativo CHECK ((costo_unitario >= (0)::numeric));
alter table public.orden_repuestos add constraint orden_repuestos_identificado CHECK (((repuesto_id IS NOT NULL) OR (length(btrim(COALESCE(descripcion_libre, ''::text))) > 0)));
alter table public.ordenes_mantencion add constraint ordenes_causa_falla_solo_correctiva CHECK (((causa_falla IS NULL) OR (tipo = 'correctiva'::tipo_mantencion)));
alter table public.ordenes_mantencion add constraint ordenes_completada_exige_fecha CHECK (((estado <> 'completada'::estado_orden) OR (fecha_ejecucion IS NOT NULL)));
alter table public.ordenes_mantencion add constraint ordenes_fuera_servicio_no_negativo CHECK (((tiempo_fuera_servicio_horas IS NULL) OR (tiempo_fuera_servicio_horas >= (0)::numeric)));
alter table public.ordenes_mantencion add constraint ordenes_montos_no_negativos CHECK (((monto_mano_obra >= (0)::numeric) AND (monto_repuestos >= (0)::numeric) AND (monto_otros >= (0)::numeric)));
alter table public.documentos add constraint documentos_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.movimientos_stock add constraint movimientos_stock_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.movimientos_stock add constraint movimientos_stock_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES ordenes_mantencion(id) ON DELETE SET NULL;
alter table public.movimientos_stock add constraint movimientos_stock_repuesto_id_fkey FOREIGN KEY (repuesto_id) REFERENCES repuestos(id) ON DELETE RESTRICT;
alter table public.orden_repuestos add constraint orden_repuestos_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES ordenes_mantencion(id) ON DELETE CASCADE;
alter table public.orden_repuestos add constraint orden_repuestos_repuesto_id_fkey FOREIGN KEY (repuesto_id) REFERENCES repuestos(id) ON DELETE RESTRICT;
alter table public.ordenes_mantencion add constraint ordenes_mantencion_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE RESTRICT;
alter table public.ordenes_mantencion add constraint ordenes_mantencion_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.ordenes_mantencion add constraint ordenes_mantencion_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES planes_mantencion(id) ON DELETE SET NULL;
alter table public.ordenes_mantencion add constraint ordenes_mantencion_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL;

-- Indices
CREATE INDEX documentos_entidad_idx ON public.documentos USING btree (entidad_tipo, entidad_id);
CREATE INDEX movimientos_linea_idx ON public.movimientos_stock USING btree (linea_id);
CREATE INDEX movimientos_orden_idx ON public.movimientos_stock USING btree (orden_id);
CREATE INDEX movimientos_repuesto_fecha_idx ON public.movimientos_stock USING btree (repuesto_id, created_at DESC);
CREATE INDEX orden_repuestos_orden_idx ON public.orden_repuestos USING btree (orden_id);
CREATE INDEX orden_repuestos_repuesto_idx ON public.orden_repuestos USING btree (repuesto_id);
CREATE INDEX ordenes_activo_fecha_idx ON public.ordenes_mantencion USING btree (activo_id, fecha_ejecucion DESC NULLS LAST);
CREATE INDEX ordenes_estado_idx ON public.ordenes_mantencion USING btree (estado);
CREATE INDEX ordenes_plan_idx ON public.ordenes_mantencion USING btree (plan_id, fecha_ejecucion DESC NULLS LAST) WHERE ((estado = 'completada'::estado_orden) AND (tipo = 'preventiva'::tipo_mantencion));
CREATE INDEX ordenes_proveedor_idx ON public.ordenes_mantencion USING btree (proveedor_id);
CREATE INDEX ordenes_tipo_fecha_idx ON public.ordenes_mantencion USING btree (tipo, fecha_ejecucion DESC NULLS LAST);

