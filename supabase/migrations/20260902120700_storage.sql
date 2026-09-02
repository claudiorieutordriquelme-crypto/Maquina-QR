-- 20260902120700_storage.sql
-- Buckets y sus politicas. El bucket documentos es privado: las facturas se sirven con signed URL generada server-side.
--
-- Reconstruido desde el catalogo de la base de produccion (proyecto
-- pnxnvorvuvkodutwordo) porque los archivos de migracion originales se
-- perdieron antes de llegar al repositorio. El registro
-- supabase_migrations.schema_migrations conservo el nombre y el orden de las
-- ocho migraciones, pero no el texto SQL. Las definiciones de funciones,
-- vistas, triggers, constraints e indices vienen textuales de pg_get_*def; las
-- sentencias create table se rearmaron desde pg_attribute. El resultado es
-- equivalente al schema vivo, no identico byte a byte al original.
-- Buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activos-fotos', 'activos-fotos', 't', 5242880, '{image/jpeg,image/png,image/webp,image/avif}'::text[])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', 'f', 20971520, '{application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel}'::text[])
on conflict (id) do nothing;

-- Politicas de Storage
create policy documentos_delete_admin on storage.objects
  as permissive for delete to authenticated
  using (((bucket_id = 'documentos'::text) AND es_admin()));

create policy documentos_escritura_operador on storage.objects
  as permissive for insert to authenticated
  with check (((bucket_id = 'documentos'::text) AND puede_operar()));

create policy documentos_lectura_autenticada on storage.objects
  as permissive for select to authenticated
  using (((bucket_id = 'documentos'::text) AND puede_leer()));

create policy fotos_delete_admin on storage.objects
  as permissive for delete to authenticated
  using (((bucket_id = 'activos-fotos'::text) AND es_admin()));

create policy fotos_escritura_operador on storage.objects
  as permissive for insert to authenticated
  with check (((bucket_id = 'activos-fotos'::text) AND puede_operar()));

create policy fotos_lectura_publica on storage.objects
  as permissive for select to anon, authenticated
  using ((bucket_id = 'activos-fotos'::text));

create policy fotos_update_operador on storage.objects
  as permissive for update to authenticated
  using (((bucket_id = 'activos-fotos'::text) AND puede_operar()))
  with check (((bucket_id = 'activos-fotos'::text) AND puede_operar()));

