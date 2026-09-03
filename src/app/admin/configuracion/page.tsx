import { redirect } from "next/navigation";
import { PERMISOS, perfilHabilitado } from "@/lib/auth";
import { cargarConfiguracion, cargarParametros, listarUsuarios } from "@/lib/datos/configuracion";
import { FormularioGenerales, FormularioParametros, ListaUsuarios } from "./piezas";

export const dynamic = "force-dynamic";

function Falla({ que }: { que: string }) {
  return (
    <p role="alert" className="rounded-md border border-acento p-4 text-sm font-medium text-gris-900">
      No pude leer {que}. Es un problema de lectura, no de datos faltantes: avisa
      a quien administra la base antes de cambiar nada acá.
    </p>
  );
}

export default async function ConfiguracionPage() {
  const perfil = await perfilHabilitado();
  if (!perfil) redirect("/login");
  /*
    Se verifica aca ademas de en el menu. El menu solo decide que se dibuja; la
    direccion se puede escribir a mano, y las acciones de esta pantalla cambian
    permisos de otras personas.
  */
  if (!PERMISOS.administrar.includes(perfil.rol)) redirect("/admin");

  const [conf, params, users] = await Promise.all([
    cargarConfiguracion(),
    cargarParametros(),
    listarUsuarios(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gris-900">Configuración</h1>
        <p className="mt-1 max-w-prose text-base text-gris-600">
          Lo que se ajusta acá cambia el comportamiento de todo el sistema: desde
          cuándo una mantención se marca como crítica hasta qué ve una persona
          que escanea un QR sin tener cuenta.
        </p>
      </div>

      <section className="space-y-3">
        {conf.error ? (
          <Falla que="la configuración" />
        ) : conf.config ? (
          <FormularioGenerales config={conf.config} />
        ) : (
          <p className="rounded-lg border border-gris-200 p-4 text-sm text-gris-600">
            La fila de configuración no existe en la base. Hay que crearla antes de
            poder ajustar los umbrales.
          </p>
        )}
      </section>

      <section className="space-y-3">
        {params.error ? (
          <Falla que="los parámetros de cálculo" />
        ) : params.parametros ? (
          <FormularioParametros parametros={params.parametros} />
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
          Usuarios y roles
        </h2>

        <p className="max-w-prose text-sm text-gris-600">
          Acá se cambia el rol de quien ya tiene cuenta y se habilitan o
          deshabilitan cuentas. <strong className="font-semibold">No se invita
          gente nueva desde esta pantalla:</strong> una persona aparece en esta
          lista recién después de registrarse. Es una consecuencia de que la
          aplicación no usa la llave de servicio de Supabase, y esa decisión es
          deliberada: esa llave salta todas las políticas de seguridad de la base.
        </p>

        {users.error ? (
          <Falla que="la lista de usuarios" />
        ) : users.usuarios.length === 0 ? (
          <p className="rounded-lg border border-gris-200 p-4 text-sm text-gris-600">
            No hay perfiles cargados, lo que es raro estando tú dentro. Revisa la
            tabla de perfiles.
          </p>
        ) : (
          <ListaUsuarios usuarios={users.usuarios} idPropio={perfil.id} />
        )}

        <p className="max-w-prose text-sm text-gris-500">
          El sistema no deja que quede sin ningún administrador activo. Si eres el
          único, primero nombra a otro y después cambia tu propio rol.
        </p>
      </section>
    </div>
  );
}
