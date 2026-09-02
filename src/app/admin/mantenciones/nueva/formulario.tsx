"use client";

import { useActionState } from "react";
import { crearOrden, type EstadoAccion } from "../acciones";

/*
  Alta de orden de mantencion.

  El select de plan lista los planes de TODOS los activos, agrupados por activo
  con optgroup. Filtrarlo segun el activo elegido exigiria estado de cliente y
  una segunda consulta; agruparlo deja claro a que maquina pertenece cada plan y
  se resuelve sin JavaScript. Si igual se elige un plan de otro activo, la
  accion lo rechaza: una orden con el plan de otra maquina rompe el calculo del
  semaforo en silencio.
*/

export type OpcionActivo = { id: string; nombre: string; codigo_interno: string };
export type OpcionPlan = { id: string; nombre: string; activo_id: string };

const TIPOS = [
  { valor: "preventiva", etiqueta: "Preventiva" },
  { valor: "correctiva", etiqueta: "Correctiva" },
  { valor: "predictiva", etiqueta: "Predictiva" },
];

const ESTADOS = [
  { valor: "programada", etiqueta: "Programada" },
  { valor: "en_ejecucion", etiqueta: "En ejecución" },
  { valor: "completada", etiqueta: "Completada" },
];

function Campo({
  nombre,
  etiqueta,
  tipo = "text",
  requerido = false,
  ayuda,
  ...resto
}: {
  nombre: string;
  etiqueta: string;
  tipo?: string;
  requerido?: boolean;
  ayuda?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gris-800">
        {etiqueta}
        {requerido ? <span className="text-acento"> *</span> : null}
      </span>
      <input
        id={nombre}
        name={nombre}
        type={tipo}
        required={requerido}
        className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900 outline-none focus:border-primario focus:ring-2 focus:ring-primario/30"
        {...resto}
      />
      {ayuda ? <span className="mt-1 block text-xs text-gris-500">{ayuda}</span> : null}
    </label>
  );
}

export function FormularioOrden({
  activos,
  planes,
  proveedores,
  activoInicial,
  planInicial,
}: {
  activos: OpcionActivo[];
  planes: OpcionPlan[];
  proveedores: { id: string; nombre: string }[];
  /*
    Vienen de la tabla por criticidad del resumen, en la direccion. Ese atajo es
    lo que hace util esa lista: de "este plan esta vencido" a "registrando la
    mantencion" en un clic, sin volver a buscar la maquina en un desplegable de
    cuarenta. Se validan contra las opciones reales antes de preseleccionar,
    porque un id inventado en la URL dejaria el select en un valor que no
    existe y el formulario no se podria enviar.
  */
  activoInicial?: string;
  planInicial?: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(crearOrden, {});

  const activoValido = activos.some((a) => a.id === activoInicial) ? activoInicial : "";
  const planValido =
    activoValido && planes.some((p) => p.id === planInicial && p.activo_id === activoValido)
      ? planInicial
      : "";

  return (
    <form action={accion} className="space-y-7">
      <section className="space-y-4">
        <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">Qué y a qué</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-gris-800">
              Activo<span className="text-acento"> *</span>
            </span>
            <select
              id="activo_id"
              name="activo_id"
              required
              defaultValue={activoValido}
              className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900"
            >
              <option value="" disabled>
                Elige el activo
              </option>
              {activos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo_interno} · {a.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gris-800">Plan de mantención</span>
            <select
              id="plan_id"
              name="plan_id"
              defaultValue={planValido}
              className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900"
            >
              <option value="">Sin plan (correctiva no planificada)</option>
              {activos.map((a) => {
                const suyos = planes.filter((p) => p.activo_id === a.id);
                if (suyos.length === 0) return null;
                return (
                  <optgroup key={a.id} label={`${a.codigo_interno} · ${a.nombre}`}>
                    {suyos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <span className="mt-1 block text-xs text-gris-500">
              Solo se puede elegir un plan del activo seleccionado. Una preventiva
              sin plan no actualiza el semáforo.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gris-800">
              Tipo<span className="text-acento"> *</span>
            </span>
            <select
              id="tipo"
              name="tipo"
              required
              defaultValue="preventiva"
              className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900"
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gris-800">
              Estado<span className="text-acento"> *</span>
            </span>
            <select
              id="estado"
              name="estado"
              required
              defaultValue="completada"
              className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900"
            >
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.etiqueta}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Descripción del trabajo</span>
          <textarea
            id="descripcion_trabajo"
            name="descripcion_trabajo"
            rows={3}
            placeholder="Cambio de aceite motor y filtros, revisión de mangueras hidráulicas."
            className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Causa de la falla</span>
          <textarea
            id="causa_falla"
            name="causa_falla"
            rows={2}
            className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900"
          />
          <span className="mt-1 block text-xs text-gris-500">
            Solo para correctivas. Ojo: este texto se publica en la ficha pública.
          </span>
        </label>
      </section>

      <section className="space-y-4 border-t border-gris-200 pt-6">
        <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">Cuándo</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo nombre="fecha_programada" etiqueta="Fecha programada" tipo="date" />
          <Campo
            nombre="fecha_ejecucion"
            etiqueta="Fecha de ejecución"
            tipo="date"
            ayuda="Obligatoria si la orden está completada."
          />
          <Campo
            nombre="tiempo_fuera_servicio_horas"
            etiqueta="Horas fuera de servicio"
            tipo="number"
            step="0.01"
            min={0}
          />
          <Campo
            nombre="horometro_ejecucion"
            etiqueta="Horómetro al ejecutar"
            tipo="number"
            step="0.01"
            min={0}
            ayuda="Actualiza el horómetro del activo por trigger."
          />
          <Campo
            nombre="kilometraje_ejecucion"
            etiqueta="Kilometraje al ejecutar"
            tipo="number"
            step="0.01"
            min={0}
          />
        </div>
      </section>

      <section className="space-y-4 border-t border-gris-200 pt-6">
        <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">Quién y cuánto</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-gris-800">Proveedor</span>
            <select
              id="proveedor_id"
              name="proveedor_id"
              defaultValue=""
              className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900"
            >
              <option value="">Trabajo interno</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <Campo
            nombre="ejecutor_interno"
            etiqueta="Ejecutor interno"
            ayuda="Ojo: este nombre se publica en la ficha pública."
          />
          <Campo nombre="numero_factura" etiqueta="Número de factura" />
          <Campo nombre="fecha_factura" etiqueta="Fecha de factura" tipo="date" />
          <Campo
            nombre="monto_mano_obra"
            etiqueta="Monto mano de obra"
            tipo="number"
            step="1"
            min={0}
          />
          <Campo nombre="monto_otros" etiqueta="Otros montos" tipo="number" step="1" min={0} />
        </div>

        <p className="text-sm text-gris-500">
          El monto de repuestos y el costo total no se ingresan: los calcula la
          base de datos a partir de las líneas de repuesto que agregues después.
        </p>
      </section>

      {estado.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-acento px-3 py-2.5 text-sm font-medium text-gris-900"
        >
          <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 fill-acento" aria-hidden="true">
            <circle cx="8" cy="8" r="7" />
            <rect x="7" y="4" width="2" height="5" rx="1" fill="var(--color-blanco)" />
            <rect x="7" y="10.5" width="2" height="2" rx="1" fill="var(--color-blanco)" />
          </svg>
          {estado.error}
        </p>
      ) : null}

      <div className="border-t border-gris-200 pt-6">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-primario px-5 py-3 text-base font-semibold text-blanco transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pendiente ? "Guardando..." : "Crear y agregar repuestos"}
        </button>
      </div>
    </form>
  );
}
