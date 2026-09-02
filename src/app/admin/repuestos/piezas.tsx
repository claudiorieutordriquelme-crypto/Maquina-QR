"use client";

import { useActionState, useState } from "react";
import {
  actualizarRepuesto,
  crearRepuesto,
  registrarMovimiento,
  type EstadoMaestro,
} from "./acciones";
import type { Repuesto } from "@/lib/datos/maestros";

const claseCampo =
  "mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900 outline-none focus:border-primario focus:ring-2 focus:ring-primario/30";

const UNIDADES = ["unidad", "litro", "kilo", "metro", "juego"];

function Mensaje({ estado }: { estado: EstadoMaestro }) {
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

export function CrearRepuesto({ proveedores }: { proveedores: { id: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoMaestro, FormData>(crearRepuesto, {});
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90"
      >
        Nuevo repuesto
      </button>
    );
  }

  return (
    <form action={accion} className="rounded-lg border border-gris-200 p-4">
      <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">Nuevo repuesto</h2>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-semibold text-gris-800">
            Código<span className="text-acento"> *</span>
          </span>
          <input name="codigo" required placeholder="FIL-ACE-01" className={claseCampo} />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-gris-800">
            Nombre<span className="text-acento"> *</span>
          </span>
          <input name="nombre" required placeholder="Filtro de aceite motor" className={claseCampo} />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Unidad</span>
          <select name="unidad_medida" defaultValue="unidad" className={claseCampo}>
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Stock mínimo</span>
          <input type="number" name="stock_minimo" step="0.001" min={0} defaultValue={0} className={claseCampo} />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Costo de referencia</span>
          <input type="number" name="costo_unitario_referencia" step="1" min={0} defaultValue={0} className={claseCampo} />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-gris-800">Proveedor habitual</span>
          <select name="proveedor_habitual_id" defaultValue="" className={claseCampo}>
            <option value="">Sin proveedor habitual</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Descripción</span>
          <input name="descripcion" className={claseCampo} />
        </label>
      </div>

      <p className="mt-2 text-xs text-gris-500">
        El stock parte en cero. El saldo se carga con un movimiento de ingreso,
        no escribiéndolo a mano: así queda respaldado en el libro que se audita.
      </p>

      <Mensaje estado={estado} />

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pendiente ? "Guardando..." : "Crear repuesto"}
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

export function EditarRepuesto({
  repuesto,
  proveedores,
}: {
  repuesto: Repuesto;
  proveedores: { id: string; nombre: string }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoMaestro, FormData>(
    actualizarRepuesto,
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
      <input type="hidden" name="id" value={repuesto.id} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-gris-800">Nombre</span>
          <input name="nombre" defaultValue={repuesto.nombre} className={claseCampo} />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Unidad</span>
          <select name="unidad_medida" defaultValue={repuesto.unidad_medida} className={claseCampo}>
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Stock mínimo</span>
          <input
            type="number"
            name="stock_minimo"
            step="0.001"
            min={0}
            defaultValue={repuesto.stock_minimo}
            className={claseCampo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Costo de referencia</span>
          <input
            type="number"
            name="costo_unitario_referencia"
            step="1"
            min={0}
            defaultValue={repuesto.costo_unitario_referencia}
            className={claseCampo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Proveedor habitual</span>
          <select
            name="proveedor_habitual_id"
            defaultValue={repuesto.proveedor_habitual_id ?? ""}
            className={claseCampo}
          >
            <option value="">Sin proveedor habitual</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-gris-800">Descripción</span>
          <input name="descripcion" defaultValue={repuesto.descripcion ?? ""} className={claseCampo} />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Estado</span>
          <select name="activo" defaultValue={repuesto.activo ? "1" : "0"} className={claseCampo}>
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
          </select>
        </label>
      </div>

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

export function RegistrarMovimiento({
  repuestos,
}: {
  repuestos: { id: string; codigo: string; nombre: string; stock_actual: number }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoMaestro, FormData>(
    registrarMovimiento,
    {},
  );

  return (
    <form action={accion} className="rounded-lg border border-gris-200 p-4">
      <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
        Movimiento de stock
      </h2>
      <p className="mt-1 text-sm text-gris-600">
        Solo ingreso y ajuste. El consumo lo genera la orden de mantención al
        cargarle repuestos, y registrarlo aquí lo descontaría dos veces.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-gris-800">Repuesto</span>
          <select name="repuesto_id" required defaultValue="" className={claseCampo}>
            <option value="" disabled>
              Elige el repuesto
            </option>
            {repuestos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.codigo} · {r.nombre} (saldo {r.stock_actual})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Tipo</span>
          <select name="tipo" defaultValue="ingreso" className={claseCampo}>
            <option value="ingreso">Ingreso</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Cantidad</span>
          <input type="number" name="cantidad" step="0.001" required className={claseCampo} />
          <span className="mt-1 block text-xs text-gris-500">
            Un ajuste puede ser negativo.
          </span>
        </label>

        <label className="block sm:col-span-4">
          <span className="text-sm font-semibold text-gris-800">
            Motivo<span className="text-acento"> *</span>
          </span>
          <input
            name="motivo"
            required
            placeholder="Compra factura 12345 / Corrección por conteo físico del 2 de septiembre"
            className={claseCampo}
          />
        </label>
      </div>

      <Mensaje estado={estado} />

      <button
        type="submit"
        disabled={pendiente}
        className="mt-3 rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pendiente ? "Registrando..." : "Registrar movimiento"}
      </button>
    </form>
  );
}
