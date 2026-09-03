"use client";

import { useActionState, useState, useTransition } from "react";
import {
  actualizarLinea,
  actualizarOrden,
  agregarLinea,
  eliminarDocumento,
  eliminarLinea,
  eliminarOrden,
  subirFactura,
  urlFirmada,
  type EstadoAccion,
} from "../acciones";

/*
  Piezas interactivas de la ficha de una orden.

  Van todas en un archivo porque comparten el mismo patron y los mismos estilos.
  Cada una es un formulario con useActionState: da el pendiente y el mensaje en
  linea sin recargar, que en un formulario largo es la diferencia entre corregir
  un dato y volver a tipear veinte.
*/

function Mensaje({ estado }: { estado: EstadoAccion }) {
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

const claseCampo =
  "mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900 outline-none focus:border-primario focus:ring-2 focus:ring-primario/30";

export function FormularioEditarOrden({
  orden,
  proveedores,
  puedeOperar,
}: {
  orden: {
    id: string;
    estado: string;
    fecha_programada: string | null;
    fecha_ejecucion: string | null;
    horometro_ejecucion: number | null;
    kilometraje_ejecucion: number | null;
    descripcion_trabajo: string;
    causa_falla: string | null;
    proveedor_id: string | null;
    ejecutor_interno: string | null;
    numero_factura: string | null;
    fecha_factura: string | null;
    monto_mano_obra: number;
    monto_otros: number;
    tiempo_fuera_servicio_horas: number | null;
  };
  proveedores: { id: string; nombre: string }[];
  puedeOperar: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(actualizarOrden, {});

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="id" value={orden.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Estado</span>
          <select
            name="estado"
            defaultValue={orden.estado}
            disabled={!puedeOperar}
            className={claseCampo}
          >
            <option value="programada">Programada</option>
            <option value="en_ejecucion">En ejecución</option>
            <option value="completada">Completada</option>
            <option value="anulada">Anulada</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Proveedor</span>
          <select
            name="proveedor_id"
            defaultValue={orden.proveedor_id ?? ""}
            disabled={!puedeOperar}
            className={claseCampo}
          >
            <option value="">Trabajo interno</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Fecha programada</span>
          <input
            type="date"
            name="fecha_programada"
            defaultValue={orden.fecha_programada ?? ""}
            disabled={!puedeOperar}
            className={claseCampo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Fecha de ejecución</span>
          <input
            type="date"
            name="fecha_ejecucion"
            defaultValue={orden.fecha_ejecucion ?? ""}
            disabled={!puedeOperar}
            className={claseCampo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Horómetro al ejecutar</span>
          <input
            type="number"
            step="0.01"
            min={0}
            name="horometro_ejecucion"
            defaultValue={orden.horometro_ejecucion ?? ""}
            disabled={!puedeOperar}
            className={claseCampo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Kilometraje al ejecutar</span>
          <input
            type="number"
            step="0.01"
            min={0}
            name="kilometraje_ejecucion"
            defaultValue={orden.kilometraje_ejecucion ?? ""}
            disabled={!puedeOperar}
            className={claseCampo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Ejecutor interno</span>
          <input
            name="ejecutor_interno"
            defaultValue={orden.ejecutor_interno ?? ""}
            disabled={!puedeOperar}
            className={claseCampo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Horas fuera de servicio</span>
          <input
            type="number"
            step="0.01"
            min={0}
            name="tiempo_fuera_servicio_horas"
            defaultValue={orden.tiempo_fuera_servicio_horas ?? ""}
            disabled={!puedeOperar}
            className={claseCampo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Número de factura</span>
          <input
            name="numero_factura"
            defaultValue={orden.numero_factura ?? ""}
            disabled={!puedeOperar}
            className={claseCampo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Fecha de factura</span>
          <input
            type="date"
            name="fecha_factura"
            defaultValue={orden.fecha_factura ?? ""}
            disabled={!puedeOperar}
            className={claseCampo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Monto mano de obra</span>
          <input
            type="number"
            step="1"
            min={0}
            name="monto_mano_obra"
            defaultValue={orden.monto_mano_obra ?? 0}
            disabled={!puedeOperar}
            className={claseCampo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Otros montos</span>
          <input
            type="number"
            step="1"
            min={0}
            name="monto_otros"
            defaultValue={orden.monto_otros ?? 0}
            disabled={!puedeOperar}
            className={claseCampo}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-gris-800">Descripción del trabajo</span>
        <textarea
          name="descripcion_trabajo"
          rows={3}
          defaultValue={orden.descripcion_trabajo}
          disabled={!puedeOperar}
          className={claseCampo}
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-gris-800">Causa de la falla</span>
        <textarea
          name="causa_falla"
          rows={2}
          defaultValue={orden.causa_falla ?? ""}
          disabled={!puedeOperar}
          className={claseCampo}
        />
        <span className="mt-1 block text-xs text-gris-500">
          Se publica en la ficha pública del activo.
        </span>
      </label>

      <Mensaje estado={estado} />

      {puedeOperar ? (
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-primario px-5 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pendiente ? "Guardando..." : "Guardar cambios"}
        </button>
      ) : (
        <p className="text-sm text-gris-500">Tu rol solo permite ver esta orden.</p>
      )}
    </form>
  );
}

export function AgregarLinea({
  ordenId,
  repuestos,
}: {
  ordenId: string;
  repuestos: {
    id: string;
    codigo: string;
    nombre: string;
    unidad_medida: string;
    costo_unitario_referencia: number;
    stock_actual: number;
  }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(agregarLinea, {});
  const [elegido, setElegido] = useState("");

  const repuesto = repuestos.find((r) => r.id === elegido);

  return (
    <form action={accion} className="rounded-lg border border-gris-200 p-4">
      <input type="hidden" name="orden_id" value={ordenId} />

      <h3 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
        Agregar repuesto
      </h3>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-gris-800">Del maestro</span>
          <select
            name="repuesto_id"
            value={elegido}
            onChange={(e) => setElegido(e.target.value)}
            className={claseCampo}
          >
            <option value="">Fuera del maestro</option>
            {repuestos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.codigo} · {r.nombre} (stock {r.stock_actual})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Cantidad</span>
          <input
            type="number"
            name="cantidad"
            step="0.001"
            min="0.001"
            required
            className={claseCampo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Costo unitario</span>
          <input
            type="number"
            name="costo_unitario"
            step="1"
            min={0}
            // Se precarga el costo de referencia del maestro, que es lo que casi
            // siempre corresponde, y queda editable porque el precio real de una
            // compra puntual puede ser otro.
            key={elegido}
            defaultValue={repuesto?.costo_unitario_referencia ?? 0}
            className={claseCampo}
          />
        </label>
      </div>

      {!elegido ? (
        <label className="mt-3 block">
          <span className="text-sm font-semibold text-gris-800">Descripción libre</span>
          <input
            name="descripcion_libre"
            placeholder="Manguera hidráulica 1/2 comprada en ferretería"
            className={claseCampo}
          />
          <span className="mt-1 block text-xs text-gris-500">
            Para repuestos que no están en el maestro. No mueven stock, porque no
            hay stock que mover.
          </span>
        </label>
      ) : (
        <p className="mt-3 text-sm text-gris-600">
          Al guardar, la base descuenta {repuesto?.unidad_medida ?? "unidades"} del
          stock por trigger y recalcula el costo de la orden.
        </p>
      )}

      <Mensaje estado={estado} />

      <button
        type="submit"
        disabled={pendiente}
        className="mt-3 rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pendiente ? "Agregando..." : "Agregar repuesto"}
      </button>
    </form>
  );
}

export function BotonEliminarLinea({ id, ordenId }: { id: string; ordenId: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(eliminarLinea, {});

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="orden_id" value={ordenId} />
      <button
        type="submit"
        disabled={pendiente}
        className="text-sm font-semibold text-acento hover:underline disabled:opacity-60"
        title="Al eliminar la línea, el trigger revierte el movimiento de stock"
      >
        {pendiente ? "Eliminando..." : "Eliminar"}
      </button>
      {estado.error ? (
        <span role="alert" className="ml-2 text-xs font-medium text-gris-900">
          {estado.error}
        </span>
      ) : null}
    </form>
  );
}

export function SubirFactura({ ordenId }: { ordenId: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(subirFactura, {});

  return (
    <form action={accion} className="rounded-lg border border-gris-200 p-4">
      <input type="hidden" name="orden_id" value={ordenId} />

      <h3 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
        Adjuntar documento
      </h3>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Tipo</span>
          <select name="tipo_documento" defaultValue="factura" className={claseCampo}>
            <option value="factura">Factura</option>
            <option value="boleta">Boleta</option>
            <option value="orden_compra">Orden de compra</option>
            <option value="foto">Foto</option>
            <option value="otro">Otro</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Archivo</span>
          <input
            type="file"
            name="archivo"
            required
            accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls"
            className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2 text-sm text-gris-900 file:mr-3 file:rounded file:border-0 file:bg-gris-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold"
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-gris-500">
        Va a un bucket privado. Nunca se sirve por URL pública: para verlo se
        firma una URL que expira en 60 segundos.
      </p>

      <Mensaje estado={estado} />

      <button
        type="submit"
        disabled={pendiente}
        className="mt-3 rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pendiente ? "Subiendo..." : "Adjuntar"}
      </button>
    </form>
  );
}

/*
  Abrir un adjunto. La URL se pide al servidor en el momento del clic y expira
  en 60 segundos, asi que nunca queda una URL de larga vida en el HTML. Una URL
  firmada que dura un mes es una URL publica con pasos extra.
*/
export function BotonVerDocumento({ storagePath }: { storagePath: string }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            setError(null);
            const url = await urlFirmada(storagePath);
            if (!url) {
              setError("No pude abrir el documento.");
              return;
            }
            window.open(url, "_blank", "noopener,noreferrer");
          })
        }
        className="text-sm font-semibold text-primario hover:underline disabled:opacity-60"
      >
        {pendiente ? "Abriendo..." : "Ver"}
      </button>
      {error ? (
        <span role="alert" className="ml-2 text-xs font-medium text-gris-900">
          {error}
        </span>
      ) : null}
    </>
  );
}

/*
  Editar una linea de repuesto ya cargada.

  Antes corregir una cantidad mal digitada exigia que un administrador borrara
  la linea y el tecnico la volviera a cargar, y eso dejaba dos movimientos extra
  en el libro de stock por cada digito equivocado. Los triggers de la base ya
  cubrian el UPDATE, solo faltaba la pantalla.
*/
export function EditarLinea({
  id,
  ordenId,
  cantidad,
  costoUnitario,
}: {
  id: string;
  ordenId: string;
  cantidad: number;
  costoUnitario: number | null;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(actualizarLinea, {});
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
    <form action={accion} className="mt-2 w-full rounded-md border border-gris-200 p-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="orden_id" value={ordenId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Cantidad</span>
          <input
            type="number"
            name="cantidad"
            step="0.01"
            min="0.01"
            required
            defaultValue={cantidad}
            className={claseCampo}
          />
          <span className="mt-1 block text-xs text-gris-500">
            Al cambiarla, la base ajusta el stock por la diferencia.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Costo unitario</span>
          <input
            type="number"
            name="costo_unitario"
            step="1"
            min="0"
            required
            defaultValue={costoUnitario ?? 0}
            className={claseCampo}
          />
          <span className="mt-1 block text-xs text-gris-500">
            El subtotal y el costo de la orden los recalcula la base.
          </span>
        </label>
      </div>

      <Mensaje estado={estado} />

      <div className="mt-3 flex flex-wrap gap-2">
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
          Cancelar
        </button>
      </div>
    </form>
  );
}

/* Quitar un adjunto. Borra la fila Y el archivo del bucket privado. */
export function BotonEliminarDocumento({
  id,
  ordenId,
  nombre,
}: {
  id: string;
  ordenId: string;
  nombre: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(
    eliminarDocumento,
    {},
  );
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-sm font-semibold text-gris-600 hover:text-acento"
      >
        Quitar
      </button>
    );
  }

  return (
    <form action={accion} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="orden_id" value={ordenId} />
      <span className="text-sm text-gris-700">¿Borrar {nombre}?</span>
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md bg-acento px-3 py-1.5 text-sm font-semibold text-negro disabled:opacity-60"
      >
        {pendiente ? "Borrando..." : "Sí, borrar"}
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="rounded-md border border-gris-300 px-3 py-1.5 text-sm font-semibold text-gris-800"
      >
        No
      </button>
      {estado.error ? (
        <span role="alert" className="basis-full text-xs font-medium text-gris-900">
          {estado.error}
        </span>
      ) : null}
    </form>
  );
}

/*
  Zona de borrado de la orden completa.

  ANULAR VA PRIMERO Y NO ES UN DETALLE DE ORDEN. Anular devuelve el stock con
  movimientos de ajuste y deja la orden en el historial con su registro: para
  el trabajo que salio mal, eso es lo correcto. Borrar es para la orden que
  nunca debio existir, y por eso queda detras de escribir el folio.
*/
export function ZonaBorradoOrden({ id, folio }: { id: string; folio: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(eliminarOrden, {});
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="flex overflow-hidden rounded-lg border border-gris-200">
      <div className="w-2 shrink-0 bg-acento" aria-hidden="true" />
      <div className="min-w-0 flex-1 p-4">
        <h2 className="text-sm font-bold text-gris-900">Borrar esta orden</h2>
        <p className="mt-1.5 max-w-prose text-sm text-gris-600">
          Antes de borrar, considera <span className="font-semibold">anularla</span>:
          cambia el estado a Anulada arriba y la base devuelve el stock con
          movimientos de ajuste, dejando la orden en el historial. Eso es lo que
          corresponde cuando el trabajo salió mal.
        </p>
        <p className="mt-1.5 max-w-prose text-sm text-gris-600">
          Borrarla la saca del historial y del reporte de costos. El stock vuelve
          igual, y el libro de movimientos conserva el consumo y su reversa,
          porque es de solo agregar. Los repuestos cargados y los adjuntos se van
          con ella.
        </p>

        {!abierto ? (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="mt-3 rounded-md border border-acento px-4 py-2.5 text-sm font-semibold text-gris-900 transition-colors hover:bg-acento hover:text-negro"
          >
            Quiero borrarla
          </button>
        ) : (
          <form action={accion} className="mt-3">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="folio_esperado" value={String(folio)} />

            <label className="block max-w-xs">
              <span className="text-sm font-semibold text-gris-800">
                Escribe el folio <span className="font-mono font-bold">{folio}</span> para
                confirmar
              </span>
              <input
                name="confirmacion"
                autoComplete="off"
                autoFocus
                inputMode="numeric"
                className={claseCampo}
                placeholder={String(folio)}
              />
            </label>

            <Mensaje estado={estado} />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={pendiente}
                className="rounded-md bg-acento px-4 py-2.5 text-sm font-semibold text-negro disabled:opacity-60"
              >
                {pendiente ? "Borrando..." : "Borrar definitivamente"}
              </button>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
