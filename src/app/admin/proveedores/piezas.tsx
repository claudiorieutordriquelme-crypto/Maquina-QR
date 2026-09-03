"use client";

import { useActionState, useState } from "react";
import {
  actualizarProveedor,
  crearProveedor,
  eliminarProveedor,
  type EstadoProveedor,
} from "./acciones";
import type { Proveedor } from "@/lib/datos/maestros";

const claseCampo =
  "mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900 outline-none focus:border-primario focus:ring-2 focus:ring-primario/30";

function Mensaje({ estado }: { estado: EstadoProveedor }) {
  if (!estado.error && !estado.ok) return null;
  const esError = Boolean(estado.error);
  return (
    <p
      role={esError ? "alert" : "status"}
      className={`mt-2 rounded-md border px-3 py-2 text-sm font-medium text-gris-900 ${
        esError ? "border-acento" : "border-secundario"
      }`}
    >
      {estado.error ?? estado.ok}
    </p>
  );
}

/*
  Campos del proveedor. Se comparten entre el alta y la edicion para que no se
  desincronicen: un campo agregado en un solo lado es un dato que se pierde
  segun por donde entre.
*/
function Campos({ valores }: { valores?: Proveedor }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="block sm:col-span-2">
        <span className="text-sm font-semibold text-gris-800">
          Nombre<span className="text-acento"> *</span>
        </span>
        <input name="nombre" required defaultValue={valores?.nombre ?? ""} className={claseCampo} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-gris-800">RUT</span>
        <input name="rut" defaultValue={valores?.rut ?? ""} placeholder="76.123.456-7" className={claseCampo} />
        <span className="mt-1 block text-xs text-gris-500">
          La base lo valida con módulo 11 y lo normaliza.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-gris-800">Giro</span>
        <input name="giro" defaultValue={valores?.giro ?? ""} className={claseCampo} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-gris-800">Contacto</span>
        <input name="contacto_nombre" defaultValue={valores?.contacto_nombre ?? ""} className={claseCampo} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-gris-800">Correo</span>
        <input
          type="email"
          name="contacto_email"
          defaultValue={valores?.contacto_email ?? ""}
          className={claseCampo}
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-gris-800">Teléfono</span>
        <input name="contacto_telefono" defaultValue={valores?.contacto_telefono ?? ""} className={claseCampo} />
      </label>

      <label className="block sm:col-span-2">
        <span className="text-sm font-semibold text-gris-800">Dirección</span>
        <input name="direccion" defaultValue={valores?.direccion ?? ""} className={claseCampo} />
      </label>

      <label className="block sm:col-span-3">
        <span className="text-sm font-semibold text-gris-800">Notas</span>
        <input name="notas" defaultValue={valores?.notas ?? ""} className={claseCampo} />
      </label>
    </div>
  );
}

export function CrearProveedor() {
  const [estado, accion, pendiente] = useActionState<EstadoProveedor, FormData>(crearProveedor, {});
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90"
      >
        Nuevo proveedor
      </button>
    );
  }

  return (
    <form action={accion} className="w-full rounded-lg border border-gris-200 p-4">
      <h2 className="mb-3 text-sm font-bold tracking-widest text-gris-500 uppercase">
        Nuevo proveedor
      </h2>
      <Campos />
      <Mensaje estado={estado} />
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco disabled:opacity-60"
        >
          {pendiente ? "Guardando..." : "Crear proveedor"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800"
        >
          Cerrar
        </button>
      </div>
    </form>
  );
}

export function EditarProveedor({ proveedor }: { proveedor: Proveedor }) {
  const [estado, accion, pendiente] = useActionState<EstadoProveedor, FormData>(
    actualizarProveedor,
    {},
  );
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-sm font-semibold text-primario hover:underline"
      >
        Editar
      </button>
    );
  }

  return (
    <form action={accion} className="mt-3 w-full rounded-md border border-gris-200 p-3">
      <input type="hidden" name="id" value={proveedor.id} />
      <Campos valores={proveedor} />

      <label className="mt-3 block sm:w-48">
        <span className="text-sm font-semibold text-gris-800">Estado</span>
        <select name="activo" defaultValue={proveedor.activo ? "1" : "0"} className={claseCampo}>
          <option value="1">Activo</option>
          <option value="0">Inactivo</option>
        </select>
      </label>

      <Mensaje estado={estado} />

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-primario px-4 py-2 text-sm font-semibold text-blanco disabled:opacity-60"
        >
          {pendiente ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-md border border-gris-300 px-4 py-2 text-sm font-semibold text-gris-800"
        >
          Cerrar
        </button>
      </div>
    </form>
  );
}

/*
  Borrar un proveedor.

  DESACTIVAR VA PRIMERO, y no como cortesia. Las dos llaves foraneas que apuntan
  a proveedores son ON DELETE SET NULL, o sea borrar no pierde el historial pero
  si pierde QUIEN hizo cada trabajo, que es justamente lo que este sistema
  existe para conservar. Un proveedor con el que ya no se trabaja se desactiva:
  deja de ofrecerse en ordenes nuevas y su historial queda completo.

  Borrar es para el proveedor que se cargo por error.
*/
export function BorrarProveedor({ proveedor }: { proveedor: Proveedor }) {
  const [estado, accion, pendiente] = useActionState<EstadoProveedor, FormData>(
    eliminarProveedor,
    {},
  );
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-sm font-semibold text-gris-600 transition-colors hover:text-acento"
      >
        Eliminar
      </button>
    );
  }

  return (
    <form action={accion} className="mt-3 w-full">
      <input type="hidden" name="id" value={proveedor.id} />
      <input type="hidden" name="nombre_esperado" value={proveedor.nombre} />

      <div className="flex overflow-hidden rounded-lg border border-gris-200">
        <div className="w-2 shrink-0 bg-acento" aria-hidden="true" />
        <div className="min-w-0 flex-1 p-4">
          <p className="text-sm font-bold text-gris-900">Borrar {proveedor.nombre}</p>
          <p className="mt-1.5 max-w-prose text-sm text-gris-600">
            Las mantenciones que hizo <span className="font-semibold">no se pierden</span>,
            pero quedan sin proveedor: se pierde quién hizo el trabajo. Si solo
            dejaste de trabajar con él, mejor edítalo y ponlo{" "}
            <span className="font-semibold">Inactivo</span>: deja de ofrecerse en
            órdenes nuevas y conserva todo su historial.
          </p>

          <label className="mt-3 block max-w-sm">
            <span className="text-sm font-semibold text-gris-800">
              Escribe <span className="font-mono font-bold">{proveedor.nombre}</span> para
              confirmar
            </span>
            <input name="confirmacion" autoComplete="off" autoFocus className={claseCampo} />
          </label>

          <Mensaje estado={estado} />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pendiente}
              className="rounded-md bg-acento px-4 py-2 text-sm font-semibold text-negro disabled:opacity-60"
            >
              {pendiente ? "Borrando..." : "Borrar definitivamente"}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-md border border-gris-300 px-4 py-2 text-sm font-semibold text-gris-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
