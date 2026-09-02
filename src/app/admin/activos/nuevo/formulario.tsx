"use client";

import { useActionState } from "react";
import { crearActivo, type EstadoFormulario } from "../acciones";
import type { TipoActivo } from "@/lib/datos/activos";

/*
  Formulario de alta de activo.

  Client Component por el estado de envio y el error en linea. Es un formulario
  largo: si al fallar recargara la pagina, se perderia todo lo tipeado, y eso
  es lo que hace que la gente deje de usar un sistema.
*/

const ESTADOS = [
  { valor: "operativo", etiqueta: "Operativo" },
  { valor: "en_mantencion", etiqueta: "En mantención" },
  { valor: "fuera_servicio", etiqueta: "Fuera de servicio" },
  { valor: "dado_de_baja", etiqueta: "Dado de baja" },
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

export function FormularioActivo({ tipos }: { tipos: TipoActivo[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(crearActivo, {});

  return (
    <form action={accion} className="space-y-7">
      <section className="space-y-4">
        <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
          Identificación
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo
            nombre="nombre"
            etiqueta="Nombre"
            requerido
            autoFocus
            placeholder="Tractor 110 HP cabina"
          />
          <Campo
            nombre="codigo_interno"
            etiqueta="Código interno"
            requerido
            placeholder="TR-002"
            ayuda="Código de flota. No puede repetirse."
          />

          <label className="block">
            <span className="text-sm font-semibold text-gris-800">
              Tipo<span className="text-acento"> *</span>
            </span>
            <select
              id="tipo_codigo"
              name="tipo_codigo"
              required
              defaultValue=""
              className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900 outline-none focus:border-primario focus:ring-2 focus:ring-primario/30"
            >
              <option value="" disabled>
                Elige un tipo
              </option>
              {tipos.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.nombre}
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
              defaultValue="operativo"
              className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900 outline-none focus:border-primario focus:ring-2 focus:ring-primario/30"
            >
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <Campo
            nombre="patente"
            etiqueta="Patente"
            placeholder="JKLM12"
            ayuda="Solo si la tiene. No toda la maquinaria agrícola la lleva."
          />
          <Campo nombre="ubicacion" etiqueta="Ubicación" placeholder="Fundo El Roble" />
          <Campo nombre="numero_serie" etiqueta="Número de serie" />
          <Campo nombre="numero_chasis" etiqueta="Número de chasis" />
        </div>
      </section>

      <section className="space-y-4 border-t border-gris-200 pt-6">
        <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">Fabricación</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo nombre="marca" etiqueta="Marca" placeholder="John Deere" />
          <Campo nombre="modelo" etiqueta="Modelo" placeholder="6110J" />
          <Campo nombre="anio" etiqueta="Año" tipo="number" min={1900} max={2100} step={1} />
        </div>
      </section>

      <section className="space-y-4 border-t border-gris-200 pt-6">
        <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
          Uso y adquisición
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo
            nombre="horometro_actual"
            etiqueta="Horómetro actual"
            tipo="number"
            step="0.01"
            min={0}
            ayuda="Sin esto, los planes por horas de uso no pueden calcular vencimiento."
          />
          <Campo
            nombre="kilometraje_actual"
            etiqueta="Kilometraje actual"
            tipo="number"
            step="0.01"
            min={0}
          />
          <Campo
            nombre="fecha_adquisicion"
            etiqueta="Fecha de adquisición"
            tipo="date"
            ayuda="Es la línea base del cálculo cuando el plan nunca se ha ejecutado."
          />
          <Campo
            nombre="valor_adquisicion"
            etiqueta="Valor de adquisición"
            tipo="number"
            step="1"
            min={0}
          />
        </div>
      </section>

      <section className="border-t border-gris-200 pt-6">
        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Notas</span>
          <textarea
            id="notas"
            name="notas"
            rows={3}
            className="mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900 outline-none focus:border-primario focus:ring-2 focus:ring-primario/30"
          />
        </label>
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

      <div className="flex flex-wrap gap-3 border-t border-gris-200 pt-6">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-primario px-5 py-3 text-base font-semibold text-blanco transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pendiente ? "Guardando..." : "Guardar y ver etiqueta QR"}
        </button>
      </div>

      <p className="text-sm text-gris-500">
        El código QR se genera solo, con un token aleatorio que crea la base de
        datos. Después de guardar se abre la etiqueta lista para imprimir.
      </p>
    </form>
  );
}
