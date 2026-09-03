"use client";

import { useActionState, useCallback, useState } from "react";
import { Dialogo } from "@/components/dialogo";
import { eliminarActivo, type EstadoFormulario } from "@/app/admin/activos/acciones";

/*
  Borrado de un activo, en dos presentaciones sobre la MISMA logica.

  Existe en dos lugares: la zona de borrado de la ficha del activo y un boton en
  cada tarjeta del listado. El formulario de confirmacion vive aca una sola vez
  a proposito. Duplicarlo garantizaba que un dia una de las dos copias perdiera
  la confirmacion por codigo, y esa es justamente la proteccion que importa.

  Que la confirmacion sea escribir el codigo interno y no un "estas seguro" no
  es ceremonia: obliga a mirar cual maquina se esta borrando. En un listado de
  cuarenta tarjetas, apretar el boton de la fila equivocada es el error mas
  facil de cometer.

  El limite duro lo pone la base, no esta pantalla: la foreign key de
  ordenes_mantencion es RESTRICT, asi que un activo con mantenciones registradas
  no se borra por ningun camino. Para una maquina con historial lo correcto es
  darla de baja, que ademas apaga su ficha publica.
*/

const claseCampo =
  "mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900 outline-none focus:border-primario focus:ring-2 focus:ring-primario/30";

function Mensaje({ estado }: { estado: EstadoFormulario }) {
  if (!estado.error && !estado.ok) return null;
  const esError = Boolean(estado.error);
  return (
    <p
      role={esError ? "alert" : "status"}
      className={`mt-3 rounded-md border px-3 py-2 text-sm font-medium text-gris-900 ${
        esError ? "border-acento" : "border-secundario"
      }`}
    >
      {estado.error ?? estado.ok}
    </p>
  );
}

export function FormularioBorrado({
  activoId,
  codigoInterno,
  alCancelar,
  enfocar = true,
}: {
  activoId: string;
  codigoInterno: string;
  alCancelar: () => void;
  enfocar?: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    eliminarActivo,
    {},
  );

  return (
    <form action={accion} className="mt-3">
      <input type="hidden" name="id" value={activoId} />
      <input type="hidden" name="codigo_esperado" value={codigoInterno} />

      <label className="block max-w-sm">
        <span className="text-sm font-semibold text-gris-800">
          Escribe <span className="font-mono font-bold">{codigoInterno}</span> para confirmar
        </span>
        <input
          name="confirmacion"
          autoComplete="off"
          autoFocus={enfocar}
          className={claseCampo}
          placeholder={codigoInterno}
        />
      </label>

      <Mensaje estado={estado} />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-acento px-4 py-2.5 text-sm font-semibold text-negro transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pendiente ? "Borrando..." : "Borrar definitivamente"}
        </button>
        <button
          type="button"
          onClick={alCancelar}
          className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function IconoBasurero({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 2h4a1 1 0 0 1 1 1v1h4v2H3V4h4V3a1 1 0 0 1 1-1zM4.5 7h11l-.8 9.1a2 2 0 0 1-2 1.9H7.3a2 2 0 0 1-2-1.9L4.5 7zm3.2 2 .3 7h1.5l-.3-7H7.7zm3.1 0-.3 7h1.5l.3-7h-1.5z"
      />
    </svg>
  );
}

/*
  Version del listado: un boton por tarjeta que abre un dialogo. Solo aparece en
  las maquinas que se pueden borrar de verdad.
*/
export function BotonBorrarActivo({
  activoId,
  codigoInterno,
  nombre,
  planes,
}: {
  activoId: string;
  codigoInterno: string;
  nombre: string;
  planes: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 font-semibold text-gris-600 transition-colors hover:text-acento"
      >
        <IconoBasurero className="size-4 shrink-0" />
        Eliminar
      </button>

      {abierto ? (
        <Dialogo
          titulo={`Borrar ${codigoInterno} ${nombre}`}
          alCerrar={cerrar}
          ancho="max-w-lg"
        >
          <div className="p-5">
            <div className="flex overflow-hidden rounded-lg border border-gris-200">
              <div className="w-2 shrink-0 bg-acento" aria-hidden="true" />
              <div className="min-w-0 flex-1 p-4">
                <h2 id={`borrar-${activoId}`} className="text-sm font-bold text-gris-900">
                  Borrar {codigoInterno} · {nombre}
                </h2>
                <p className="mt-1.5 text-sm text-gris-600">
                  No tiene mantenciones registradas, así que se puede borrar. Se
                  van con él {planes}{" "}
                  {planes === 1 ? "plan de mantención" : "planes de mantención"} y sus
                  lecturas de horómetro. No hay forma de deshacerlo desde aquí, y
                  su código QR impreso deja de funcionar.
                </p>

                {/*
                  enfocar en false: el foco inicial ya lo pone Dialogo en el
                  primer campo, que es este mismo input. Dos cosas peleando por
                  el foco dejaban el cursor en el contenedor y el usuario
                  escribia sin que entrara ninguna tecla.
                */}
                <FormularioBorrado
                  activoId={activoId}
                  codigoInterno={codigoInterno}
                  alCancelar={cerrar}
                  enfocar={false}
                />
              </div>
            </div>
          </div>
        </Dialogo>
      ) : null}
    </>
  );
}
