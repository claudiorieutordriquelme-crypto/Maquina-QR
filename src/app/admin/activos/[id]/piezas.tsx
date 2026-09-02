"use client";

import { useActionState, useState } from "react";
import { actualizarActivo, eliminarActivo, type EstadoFormulario } from "../acciones";
import type { Activo, TipoActivo } from "@/lib/datos/activos";

const claseCampo =
  "mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900 outline-none focus:border-primario focus:ring-2 focus:ring-primario/30";

const ESTADOS = [
  { valor: "operativo", etiqueta: "Operativo" },
  { valor: "en_mantencion", etiqueta: "En mantención" },
  { valor: "fuera_servicio", etiqueta: "Fuera de servicio" },
  { valor: "dado_de_baja", etiqueta: "Dado de baja" },
];

function Mensaje({ estado }: { estado: EstadoFormulario }) {
  if (!estado.error && !estado.ok) return null;
  const esError = Boolean(estado.error);
  return (
    <p
      role={esError ? "alert" : "status"}
      className={`mt-3 rounded-md border px-3 py-2.5 text-sm font-medium text-gris-900 ${
        esError ? "border-acento" : "border-secundario"
      }`}
    >
      {estado.error ?? estado.ok}
    </p>
  );
}

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
      <input id={nombre} name={nombre} type={tipo} required={requerido} className={claseCampo} {...resto} />
      {ayuda ? <span className="mt-1 block text-xs text-gris-500">{ayuda}</span> : null}
    </label>
  );
}

export function EditarActivo({ activo, tipos }: { activo: Activo; tipos: TipoActivo[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    actualizarActivo,
    {},
  );

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="id" value={activo.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo nombre="nombre" etiqueta="Nombre" requerido defaultValue={activo.nombre} />
        <Campo
          nombre="codigo_interno"
          etiqueta="Código interno"
          requerido
          defaultValue={activo.codigo_interno}
          ayuda="Cambiarlo no afecta el código QR ya impreso."
        />

        <label className="block">
          <span className="text-sm font-semibold text-gris-800">
            Tipo<span className="text-acento"> *</span>
          </span>
          <select name="tipo_codigo" required defaultValue={activo.tipo_codigo} className={claseCampo}>
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
          <select name="estado" required defaultValue={activo.estado} className={claseCampo}>
            {ESTADOS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-gris-500">
            Al pasarlo a “dado de baja”, su ficha pública deja de responder y no
            aparece en la impresión de etiquetas.
          </span>
        </label>

        <Campo nombre="patente" etiqueta="Patente" defaultValue={activo.patente ?? ""} />
        <Campo nombre="ubicacion" etiqueta="Ubicación" defaultValue={activo.ubicacion ?? ""} />
        <Campo nombre="marca" etiqueta="Marca" defaultValue={activo.marca ?? ""} />
        <Campo nombre="modelo" etiqueta="Modelo" defaultValue={activo.modelo ?? ""} />
        <Campo
          nombre="anio"
          etiqueta="Año"
          tipo="number"
          min={1900}
          max={2100}
          defaultValue={activo.anio ?? ""}
        />
        <Campo
          nombre="numero_serie"
          etiqueta="Número de serie"
          defaultValue={activo.numero_serie ?? ""}
        />
        <Campo
          nombre="numero_chasis"
          etiqueta="Número de chasis"
          defaultValue={activo.numero_chasis ?? ""}
        />
        <Campo
          nombre="horometro_actual"
          etiqueta="Horómetro actual"
          tipo="number"
          step="0.01"
          min={0}
          defaultValue={activo.horometro_actual ?? ""}
          ayuda="Normalmente lo mueve el sistema al registrar una lectura o una mantención."
        />
        <Campo
          nombre="kilometraje_actual"
          etiqueta="Kilometraje actual"
          tipo="number"
          step="0.01"
          min={0}
          defaultValue={activo.kilometraje_actual ?? ""}
        />
        <Campo
          nombre="fecha_adquisicion"
          etiqueta="Fecha de adquisición"
          tipo="date"
          defaultValue={activo.fecha_adquisicion ?? ""}
          ayuda="Es la línea base del cálculo cuando el plan nunca se ha ejecutado."
        />
        <Campo
          nombre="valor_adquisicion"
          etiqueta="Valor de adquisición"
          tipo="number"
          step="1"
          min={0}
          defaultValue={activo.valor_adquisicion ?? ""}
        />
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-gris-800">Notas</span>
        <textarea name="notas" rows={3} defaultValue={activo.notas ?? ""} className={claseCampo} />
      </label>

      <Mensaje estado={estado} />

      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md bg-primario px-5 py-3 text-base font-semibold text-blanco transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pendiente ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}

/*
  Zona de borrado.

  Pide escribir el codigo interno, y eso no es friccion decorativa: borrar un
  activo se lleva en cascada sus planes de mantencion y todas sus lecturas de
  horometro. Un click perdido no puede costar eso.

  Cuando el activo tiene mantenciones registradas, no se ofrece el borrado: la
  base lo impide con una foreign key RESTRICT para no perder el historial, y
  mostrar un boton que siempre va a fallar es peor que no mostrarlo. En ese caso
  se explica la alternativa real, que es darlo de baja.
*/
export function ZonaBorrado({
  activo,
  ordenes,
  planes,
  lecturas,
}: {
  activo: Activo;
  ordenes: number;
  planes: number;
  lecturas: number;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    eliminarActivo,
    {},
  );
  const [abierto, setAbierto] = useState(false);

  if (ordenes > 0) {
    return (
      <div className="flex overflow-hidden rounded-lg border border-gris-200">
        <div className="w-2 shrink-0 bg-gris-300" aria-hidden="true" />
        <div className="p-4">
          <h2 className="text-sm font-bold text-gris-900">Este activo no se puede borrar</h2>
          <p className="mt-1.5 max-w-prose text-sm text-gris-600">
            Tiene {ordenes} {ordenes === 1 ? "mantención registrada" : "mantenciones registradas"} y
            la base de datos impide borrarlo, para no perder el historial. Si la
            máquina salió de la flota, cámbiala arriba al estado{" "}
            <span className="font-semibold">dado de baja</span>: deja de aparecer
            en los listados y en la impresión de etiquetas, y su ficha pública
            deja de responder.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex overflow-hidden rounded-lg border border-gris-200">
      <div className="w-2 shrink-0 bg-acento" aria-hidden="true" />
      <div className="min-w-0 flex-1 p-4">
        <h2 className="text-sm font-bold text-gris-900">Borrar este activo</h2>
        <p className="mt-1.5 max-w-prose text-sm text-gris-600">
          No tiene mantenciones registradas, así que se puede borrar. Se van con
          él {planes} {planes === 1 ? "plan de mantención" : "planes de mantención"} y {lecturas}{" "}
          {lecturas === 1 ? "lectura de horómetro" : "lecturas de horómetro"}. No hay
          forma de deshacerlo desde aquí.
        </p>

        {!abierto ? (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="mt-3 rounded-md border border-acento px-4 py-2.5 text-sm font-semibold text-gris-900 transition-colors hover:bg-acento hover:text-negro"
          >
            Quiero borrarlo
          </button>
        ) : (
          <form action={accion} className="mt-3">
            <input type="hidden" name="id" value={activo.id} />
            <input type="hidden" name="codigo_esperado" value={activo.codigo_interno} />

            <label className="block max-w-sm">
              <span className="text-sm font-semibold text-gris-800">
                Escribe{" "}
                <span className="font-mono font-bold">{activo.codigo_interno}</span> para
                confirmar
              </span>
              <input
                name="confirmacion"
                autoComplete="off"
                autoFocus
                className={claseCampo}
                placeholder={activo.codigo_interno}
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
