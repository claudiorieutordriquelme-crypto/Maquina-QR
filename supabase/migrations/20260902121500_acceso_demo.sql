-- 20260902121500_acceso_demo.sql
-- Credenciales de la cuenta de demostracion que se publica en /login, guardadas
-- en la base y no en el codigo.
--
-- Por que existe esta tabla en vez de una constante en el repositorio: la regla
-- de cero credenciales prohibe explicitamente las contraseñas de demostracion en
-- el arbol de codigo. Aca la clave se carga por SQL, nunca entra a git, y
-- rotarla es un UPDATE en vez de un commit y un despliegue.
--
-- Por que no basta con variables de entorno, que seria mas limpio todavia: en
-- Vercel hay que cargarlas a mano y aplicar un redespliegue, y mientras eso no
-- ocurra la funcionalidad simplemente no existe en produccion. Esta tabla la
-- deja operativa desde el primer deploy.
--
-- Lo que NO va aca nunca es una cuenta con permiso de escritura. Este login es
-- alcanzable desde internet, y la funcion de abajo entrega la clave en texto
-- claro a cualquiera que la invoque, igual que la pagina la imprime. Tiene que
-- ser una cuenta de rol lector.

-- Tabla de una sola fila, con el mismo patron que configuracion y
-- parametros_calculo: id booleano con default true, asi el primary key impide
-- que existan dos configuraciones compitiendo.
create table public.acceso_demo (
  id boolean default true not null,
  email text not null,
  password text,
  habilitado boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table public.acceso_demo add constraint acceso_demo_pkey primary key (id);
alter table public.acceso_demo add constraint acceso_demo_fila_unica check (id);

alter table public.acceso_demo enable row level security;

-- Solo el administrador ve o cambia esto desde el panel. El resto de los roles
-- no tiene por que leer una contraseña, aunque sea de demostracion.
create policy acceso_demo_admin on public.acceso_demo
  as permissive for all to authenticated
  using (es_admin())
  with check (es_admin());

-- Un proyecto Supabase trae auto_expose_new_tables activo: cada tabla creada en
-- public recibe GRANT para anon sin que nadie lo pida. Se revoca explicitamente,
-- igual que el resto de las tablas del schema.
revoke all on table public.acceso_demo from anon;

create trigger acceso_demo_set_updated_at
  before update on public.acceso_demo
  for each row execute function tg_set_updated_at();

/*
  Segunda y ultima funcion ejecutable por anon, despues de get_ficha_publica.

  Entrega la credencial en texto claro a quien la invoque, y eso es
  intencional: su unico proposito es que la pagina de login la imprima en
  pantalla para que cualquiera pueda entrar a mirar. No hay confidencialidad
  que proteger.

  Devuelve null cuando la demo esta deshabilitada o sin clave cargada, y en ese
  caso el recuadro de /login no se renderiza. Asi la demo se apaga con un UPDATE
  y sin desplegar nada.
*/
create or replace function public.credenciales_demo()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select case
           when d.habilitado
                and d.password is not null
                and length(btrim(d.password)) > 0
             then jsonb_build_object('email', d.email, 'password', d.password)
           else null
         end
  from public.acceso_demo d
  where d.id;
$function$;

revoke execute on function public.credenciales_demo() from public;
grant execute on function public.credenciales_demo() to anon;
grant execute on function public.credenciales_demo() to authenticated;

-- La fila nace deshabilitada y sin clave: la demo queda apagada hasta que
-- alguien cargue la contraseña por SQL. El correo si puede vivir aca, no es
-- una credencial.
insert into public.acceso_demo (email, password, habilitado)
values ('lector@demo.local', null, false)
on conflict (id) do nothing;
