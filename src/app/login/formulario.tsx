"use client";

import { useActionState } from "react";
import { BotonDemo } from "@/components/boton-demo";
import { iniciarSesion, type EstadoLogin } from "./acciones";

function Alerta({ mensaje }: { mensaje: string }) {
  return (
    // role=alert para que un lector de pantalla lo anuncie al aparecer, y borde
    // mas glifo porque el acento solo no alcanza en contraste para texto chico.
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-acento px-3 py-2.5 text-sm font-medium text-gris-900"
    >
      <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 fill-acento" aria-hidden="true">
        <circle cx="8" cy="8" r="7" />
        <rect x="7" y="4" width="2" height="5" rx="1" fill="var(--color-blanco)" />
        <rect x="7" y="10.5" width="2" height="2" rx="1" fill="var(--color-blanco)" />
      </svg>
      {mensaje}
    </p>
  );
}

/*
  Recuadro de acceso de demostracion.

  Muestra las credenciales en texto, para poder copiarlas o compartirlas por
  mensaje, y ofrece el boton que entra sin tipear nada. El boton es el mismo
  componente que usa la portada.

  La cuenta que se publica aca tiene que ser SIEMPRE de solo lectura: este login
  es alcanzable desde internet.
*/
function AccesoDemo({ email, password }: { email: string; password: string }) {
  return (
    <section className="mt-9 rounded-lg border border-gris-200 p-4">
      <h2 className="text-xs font-bold tracking-widest text-primario uppercase">
        Acceso de demostración
      </h2>

      <p className="mt-2 text-sm text-gris-600">
        Cuenta de solo lectura. Permite recorrer todo el panel sin poder modificar
        ni borrar nada.
      </p>

      <dl className="mt-3 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <dt className="text-xs font-semibold tracking-wide text-gris-500 uppercase">Correo</dt>
          <dd className="font-mono text-sm font-semibold break-all text-gris-900">{email}</dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <dt className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
            Contraseña
          </dt>
          <dd className="font-mono text-sm font-semibold break-all text-gris-900">{password}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <BotonDemo variante="secundario" etiqueta="Ingresar como DEMO" />
      </div>
    </section>
  );
}

/*
  Client Component a proposito: un formulario de login sin estado de envio se
  siente roto con conexion mala, que es justamente la condicion de uso.
  useActionState da el pendiente y el error en linea sin recargar. No cuesta
  bundle extra, porque el runtime de Next ya viaja en todas las paginas.
*/
export function FormularioLogin({
  volver,
  demo,
}: {
  volver: string;
  demo: { email: string; password: string } | null;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoLogin, FormData>(iniciarSesion, {});

  return (
    <>
      <form action={accion} className="space-y-5">
        <input type="hidden" name="volver" value={volver} />

        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gris-800">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900 outline-none focus:border-primario focus:ring-2 focus:ring-primario/30"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-gris-800">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900 outline-none focus:border-primario focus:ring-2 focus:ring-primario/30"
          />
        </div>

        {estado.error ? <Alerta mensaje={estado.error} /> : null}

        <button
          type="submit"
          disabled={pendiente}
          className="w-full rounded-md bg-primario px-5 py-3 text-base font-semibold text-blanco transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pendiente ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {demo ? <AccesoDemo email={demo.email} password={demo.password} /> : null}
    </>
  );
}
