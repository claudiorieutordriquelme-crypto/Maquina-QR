-- 20260902120600_rls.sql
-- Row Level Security tabla por tabla y revocacion explicita para anon.
--
-- Reconstruido desde el catalogo de la base de produccion (proyecto
-- pnxnvorvuvkodutwordo) porque los archivos de migracion originales se
-- perdieron antes de llegar al repositorio. El registro
-- supabase_migrations.schema_migrations conservo el nombre y el orden de las
-- ocho migraciones, pero no el texto SQL. Las definiciones de funciones,
-- vistas, triggers, constraints e indices vienen textuales de pg_get_*def; las
-- sentencias create table se rearmaron desde pg_attribute. El resultado es
-- equivalente al schema vivo, no identico byte a byte al original.
-- RLS activada tabla por tabla
alter table public.activos enable row level security;
alter table public.configuracion enable row level security;
alter table public.documentos enable row level security;
alter table public.lecturas_uso enable row level security;
alter table public.movimientos_stock enable row level security;
alter table public.orden_repuestos enable row level security;
alter table public.ordenes_mantencion enable row level security;
alter table public.parametros_calculo enable row level security;
alter table public.planes_mantencion enable row level security;
alter table public.profiles enable row level security;
alter table public.proveedores enable row level security;
alter table public.rate_limit_publico enable row level security;
alter table public.repuestos enable row level security;
alter table public.tipos_activo enable row level security;

-- Politicas
create policy activos_admin on public.activos
  as permissive for all to authenticated
  using (es_admin())
  with check (es_admin());

create policy activos_select on public.activos
  as permissive for select to authenticated
  using (puede_leer());

create policy configuracion_select on public.configuracion
  as permissive for select to authenticated
  using (puede_leer());

create policy configuracion_update_admin on public.configuracion
  as permissive for update to authenticated
  using (es_admin())
  with check (es_admin());

create policy documentos_delete_admin on public.documentos
  as permissive for delete to authenticated
  using (es_admin());

create policy documentos_insert_operador on public.documentos
  as permissive for insert to authenticated
  with check (puede_operar());

create policy documentos_select on public.documentos
  as permissive for select to authenticated
  using (puede_leer());

create policy documentos_update_operador on public.documentos
  as permissive for update to authenticated
  using (puede_operar())
  with check (puede_operar());

create policy lecturas_delete_admin on public.lecturas_uso
  as permissive for delete to authenticated
  using (es_admin());

create policy lecturas_insert_operador on public.lecturas_uso
  as permissive for insert to authenticated
  with check (puede_operar());

create policy lecturas_select on public.lecturas_uso
  as permissive for select to authenticated
  using (puede_leer());

create policy lecturas_update_admin on public.lecturas_uso
  as permissive for update to authenticated
  using (es_admin())
  with check (es_admin());

create policy movimientos_insert_operador on public.movimientos_stock
  as permissive for insert to authenticated
  with check (puede_operar());

create policy movimientos_select on public.movimientos_stock
  as permissive for select to authenticated
  using (puede_leer());

create policy orden_repuestos_delete_admin on public.orden_repuestos
  as permissive for delete to authenticated
  using (es_admin());

create policy orden_repuestos_insert_operador on public.orden_repuestos
  as permissive for insert to authenticated
  with check (puede_operar());

create policy orden_repuestos_select on public.orden_repuestos
  as permissive for select to authenticated
  using (puede_leer());

create policy orden_repuestos_update_operador on public.orden_repuestos
  as permissive for update to authenticated
  using (puede_operar())
  with check (puede_operar());

create policy ordenes_delete_admin on public.ordenes_mantencion
  as permissive for delete to authenticated
  using (es_admin());

create policy ordenes_insert_operador on public.ordenes_mantencion
  as permissive for insert to authenticated
  with check (puede_operar());

create policy ordenes_select on public.ordenes_mantencion
  as permissive for select to authenticated
  using (puede_leer());

create policy ordenes_update_operador on public.ordenes_mantencion
  as permissive for update to authenticated
  using (puede_operar())
  with check (puede_operar());

create policy parametros_select on public.parametros_calculo
  as permissive for select to authenticated
  using (puede_leer());

create policy parametros_update_admin on public.parametros_calculo
  as permissive for update to authenticated
  using (es_admin())
  with check (es_admin());

create policy planes_admin on public.planes_mantencion
  as permissive for all to authenticated
  using (es_admin())
  with check (es_admin());

create policy planes_select on public.planes_mantencion
  as permissive for select to authenticated
  using (puede_leer());

create policy profiles_admin_all on public.profiles
  as permissive for all to authenticated
  using (es_admin())
  with check (es_admin());

create policy profiles_select_equipo on public.profiles
  as permissive for select to authenticated
  using (puede_leer());

create policy profiles_select_propio on public.profiles
  as permissive for select to authenticated
  using ((user_id = auth.uid()));

create policy profiles_update_propio_nombre on public.profiles
  as permissive for update to authenticated
  using ((user_id = auth.uid()))
  with check (((user_id = auth.uid()) AND (rol = mi_rol())));

create policy proveedores_admin on public.proveedores
  as permissive for all to authenticated
  using (es_admin())
  with check (es_admin());

create policy proveedores_select on public.proveedores
  as permissive for select to authenticated
  using (puede_leer());

create policy repuestos_admin on public.repuestos
  as permissive for all to authenticated
  using (es_admin())
  with check (es_admin());

create policy repuestos_select on public.repuestos
  as permissive for select to authenticated
  using (puede_leer());

create policy tipos_activo_admin on public.tipos_activo
  as permissive for all to authenticated
  using (es_admin())
  with check (es_admin());

create policy tipos_activo_select on public.tipos_activo
  as permissive for select to authenticated
  using (puede_leer());

-- Un proyecto Supabase trae auto_expose_new_tables activo: cada tabla creada
-- en public recibe GRANT para anon sin que nadie lo pida. Se revoca en bloque
-- y se cambian ademas los privilegios por defecto, para que una tabla futura
-- no vuelva a quedar expuesta por olvido.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- La ficha publica sale solo por aca. El grant se hace explicito para no
-- depender del EXECUTE que Postgres otorga a PUBLIC por defecto.
grant execute on function public.get_ficha_publica(uuid) to anon;

