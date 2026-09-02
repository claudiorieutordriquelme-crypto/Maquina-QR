"use client";

import { useActionState } from "react";
import { entrarComoDemo, type EstadoLogin } from "@/app/login/acciones";

/*
  Boton que entra al panel con la cuenta de demostracion en un clic.

  Se usa en dos lugares, la portada y el recuadro de /login, y vive en un solo
  componente para que no se dupliquen ni el texto ni el manejo del error.

  Client Component por el estado de envio: un boton que no muestra nada mientras
  espera se siente roto con conexion mala, y este es el primer clic que da
  cualquiera que llega al sitio.

  La contraseña no viaja en el formulario: la accion la lee en el servidor. Si
  fuera un campo oculto, cualquiera podria reemplazarla y usar esta accion como
  un segundo login sin el mensaje de error generico del formulario normal.
*/
export function BotonDemo({
  variante = "primario",
  etiqueta = "Ingresar como DEMO",
  volver,
}: {
  variante?: "primario" | "secundario";
  etiqueta?: string;
  /** Destino al que volver despues de entrar, si venia uno guardado. */
  volver?: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoLogin, FormData>(entrarComoDemo, {});

  const estilo =
    variante === "primario"
      ? "bg-primario text-blanco hover:opacity-90"
      : "border border-primario text-primario hover:bg-primario hover:text-blanco";

  return (
    <div>
      <form action={accion}>
        {volver ? <input type="hidden" name="volver" value={volver} /> : null}
        <button
          type="submit"
          disabled={pendiente}
          className={`inline-flex w-full items-center justify-center rounded-md px-5 py-3 text-base font-semibold transition-colors disabled:opacity-60 sm:w-auto ${estilo}`}
        >
          {pendiente ? "Entrando..." : etiqueta}
        </button>
      </form>

      {estado.error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-gris-900">
          {estado.error}
        </p>
      ) : null}
    </div>
  );
}
