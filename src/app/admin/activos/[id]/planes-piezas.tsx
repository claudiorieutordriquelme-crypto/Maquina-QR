"use client";

import { useActionState, useState } from "react";
import {
  actualizarPlan,
  alternarPlanActivo,
  crearPlan,
  eliminarPlan,
  type EstadoPlan,
} from "./planes-acciones";
import type { PlanDeActivo } from "@/lib/datos/activos";

/*
  Administracion de planes de mantencion desde la ficha del activo.

  Vive aca y no en una seccion propia del menu porque un plan no existe solo:
  siempre pertenece a una maquina, y su intervalo se decide mirando esa maquina.
  Una pantalla "Planes" con un desplegable de cuarenta activos seria un paso mas
  para llegar al mismo lugar.

  Las tres acciones tienen pesos distintos y la pantalla lo refleja:
  - Editar es lo habitual, va con el lapiz y abre el mismo formulario del alta.
  - Desactivar es la salida correcta para un plan que ya no aplica: deja de
    calcular semaforo y CONSERVA el vinculo con su historial de ordenes. Va
    antes que borrar a proposito.
  - Borrar es definitivo y pide escribir el nombre del plan. El historial no se
    pierde, porque la llave foranea es ON DELETE SET NULL, pero el vinculo si.
*/

const claseCampo =
  "mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900 outline-none focus:border-primario focus:ring-2 focus:ring-primario/30";

function Mensaje({ estado }: { estado: EstadoPlan }) {
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

/*
  Campos compartidos entre el alta y la edicion. Un campo agregado en un solo
  lado es un dato que se pierde segun por donde entre.
*/
function Campos({ plan }: { plan?: PlanDeActivo }) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-gris-800">
          Nombre del plan<span className="text-acento"> *</span>
        </span>
        <input
          name="nombre"
          required
          defaultValue={plan?.nombre ?? ""}
          placeholder="Cambio de aceite y filtros"
          className={claseCampo}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Cada cuántos días</span>
          <input
            type="number"
            name="intervalo_dias"
            min={1}
            step={1}
            defaultValue={plan?.intervalo_dias ?? ""}
            className={claseCampo}
          />
          <span className="mt-1 block text-xs text-gris-500">
            Por calendario. Déjalo vacío si el plan solo depende del uso.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Cada cuántas horas de uso</span>
          <input
            type="number"
            name="intervalo_horas"
            min={1}
            step="0.01"
            defaultValue={plan?.intervalo_horas ?? ""}
            className={claseCampo}
          />
          <span className="mt-1 block text-xs text-gris-500">
            Por horómetro. Sin lecturas cargadas detecta el vencimiento, pero no
            lo anticipa en días.
          </span>
        </label>
      </div>

      <p className="text-xs text-gris-500">
        Hace falta al menos uno de los dos intervalos. Con los dos, el semáforo
        avisa por el que venza primero.
      </p>

      <label className="block">
        <span className="text-sm font-semibold text-gris-800">Tareas del plan</span>
        <textarea
          name="descripcion_tareas"
          rows={3}
          defaultValue={plan?.descripcion_tareas ?? ""}
          placeholder="Aceite motor 15W40, filtro de aceite, filtro de aire, revisión de mangueras."
          className={claseCampo}
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="activo"
          value="1"
          defaultChecked={plan?.activo ?? true}
          className="size-5 accent-[var(--color-primario)]"
        />
        <span className="text-sm font-semibold text-gris-800">
          Plan activo (calcula semáforo)
        </span>
      </label>
    </div>
  );
}

export function NuevoPlan({ activoId }: { activoId: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoPlan, FormData>(crearPlan, {});
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90"
      >
        Nuevo plan
      </button>
    );
  }

  return (
    <form action={accion} className="w-full rounded-lg border border-gris-200 p-4">
      <h3 className="mb-3 text-sm font-bold tracking-widest text-gris-500 uppercase">
        Nuevo plan de mantención
      </h3>
      <input type="hidden" name="activo_id" value={activoId} />
      <Campos />
      <Mensaje estado={estado} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pendiente ? "Guardando..." : "Crear plan"}
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
  );
}

function FormularioEdicion({
  plan,
  activoId,
  alCerrar,
}: {
  plan: PlanDeActivo;
  activoId: string;
  alCerrar: () => void;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoPlan, FormData>(actualizarPlan, {});

  return (
    <form action={accion} className="mt-3 border-t border-gris-100 pt-3">
      <input type="hidden" name="id" value={plan.id} />
      <input type="hidden" name="activo_id" value={activoId} />
      <Campos plan={plan} />
      <Mensaje estado={estado} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pendiente ? "Guardando..." : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={alCerrar}
          className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormularioBorrado({
  plan,
  activoId,
  alCerrar,
}: {
  plan: PlanDeActivo;
  activoId: string;
  alCerrar: () => void;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoPlan, FormData>(eliminarPlan, {});

  return (
    <form action={accion} className="mt-3 border-t border-gris-100 pt-3">
      <input type="hidden" name="id" value={plan.id} />
      <input type="hidden" name="activo_id" value={activoId} />
      <input type="hidden" name="nombre_esperado" value={plan.nombre} />

      <div className="flex overflow-hidden rounded-lg border border-gris-200">
        <div className="w-2 shrink-0 bg-acento" aria-hidden="true" />
        <div className="min-w-0 flex-1 p-4">
          <p className="text-sm font-bold text-gris-900">Borrar este plan</p>
          <p className="mt-1.5 text-sm text-gris-600">
            El activo deja de tener este semáforo. Las mantenciones ya
            registradas <span className="font-semibold">no se pierden</span>, pero
            quedan sin plan asociado. Si el plan solo dejó de aplicar, conviene
            desactivarlo en vez de borrarlo: conserva el vínculo con su historial.
          </p>

          <label className="mt-3 block max-w-sm">
            <span className="text-sm font-semibold text-gris-800">
              Escribe <span className="font-mono font-bold">{plan.nombre}</span> para confirmar
            </span>
            <input name="confirmacion" autoComplete="off" autoFocus className={claseCampo} />
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
              onClick={alCerrar}
              className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function BotonDesactivar({ plan, activoId }: { plan: PlanDeActivo; activoId: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoPlan, FormData>(alternarPlanActivo, {});

  return (
    <>
      <form action={accion} className="contents">
        <input type="hidden" name="id" value={plan.id} />
        <input type="hidden" name="activo_id" value={activoId} />
        <input type="hidden" name="activar" value={plan.activo ? "0" : "1"} />
        <button
          type="submit"
          disabled={pendiente}
          className="font-semibold text-gris-600 transition-colors hover:text-primario disabled:opacity-60"
        >
          {pendiente ? "..." : plan.activo ? "Desactivar" : "Reactivar"}
        </button>
      </form>
      {estado.error || estado.ok ? (
        <span className="basis-full">
          <Mensaje estado={estado} />
        </span>
      ) : null}
    </>
  );
}

/*
  Controles de una fila de plan. Se separa del render del plan en la pagina
  (Server Component) para que solo esta parte llegue al navegador.
*/
export function AccionesPlan({ plan, activoId }: { plan: PlanDeActivo; activoId: string }) {
  const [modo, setModo] = useState<"cerrado" | "editar" | "borrar">("cerrado");
  const cerrar = () => setModo("cerrado");

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gris-100 pt-3 text-sm">
        <button
          type="button"
          onClick={() => setModo(modo === "editar" ? "cerrado" : "editar")}
          aria-expanded={modo === "editar"}
          className="inline-flex items-center gap-1.5 font-semibold text-primario hover:underline"
        >
          <svg viewBox="0 0 20 20" className="size-4 shrink-0 fill-current" aria-hidden="true">
            <path d="M14.7 2.3a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4L16.3 7 13 3.7l1.7-1.4z" />
            <path d="M11.6 5.1 15 8.5l-7.4 7.4-3.4.6.6-3.4 6.8-8z" />
          </svg>
          Editar
        </button>

        <BotonDesactivar plan={plan} activoId={activoId} />

        <button
          type="button"
          onClick={() => setModo(modo === "borrar" ? "cerrado" : "borrar")}
          aria-expanded={modo === "borrar"}
          className="inline-flex items-center gap-1.5 font-semibold text-gris-600 transition-colors hover:text-acento"
        >
          <svg viewBox="0 0 20 20" className="size-4 shrink-0 fill-current" aria-hidden="true">
            <path d="M8 2h4a1 1 0 0 1 1 1v1h4v2H3V4h4V3a1 1 0 0 1 1-1zM4.5 7h11l-.8 9.1a2 2 0 0 1-2 1.9H7.3a2 2 0 0 1-2-1.9L4.5 7z" />
          </svg>
          Eliminar
        </button>
      </div>

      {modo === "editar" ? (
        <FormularioEdicion plan={plan} activoId={activoId} alCerrar={cerrar} />
      ) : null}
      {modo === "borrar" ? (
        <FormularioBorrado plan={plan} activoId={activoId} alCerrar={cerrar} />
      ) : null}
    </div>
  );
}
