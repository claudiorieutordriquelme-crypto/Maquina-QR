"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Dialogo } from "@/components/dialogo";
import { SerieGasto } from "@/components/graficos/serie-gasto";
import {
  ETIQUETA_ESTADO_ACTIVO,
  formateaFechaCorta,
  formateaHoras,
  formateaNumero,
  formateaPesos,
} from "@/lib/formato";
import type { GastoActivo, PanelGasto } from "@/lib/datos/reportes";

/*
  Gasto de mantencion de la flota, en el resumen.

  Client Component por una sola razon: la previsualizacion. Los datos vienen
  calculados del servidor, ya recortados a lo que se muestra, asi que aca no hay
  ninguna consulta. Eso es deliberado: abrir la ficha rapida de una maquina en
  terreno, con señal mala, no puede depender de un viaje mas a la red.

  Limite conocido: la serie mensual de cada maquina viaja en la carga de la
  pagina aunque nadie abra ninguna previsualizacion. Con decenas de maquinas y
  veinticuatro meses son unos pocos kilobytes. Si la flota creciera a cientos,
  esto pasa a pedirse cuando se abre el modal.
*/

const MAXIMO_VISIBLE = 8;

function IconoOjo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 4c-3.8 0-6.9 2.4-8.4 5.6a1 1 0 0 0 0 .8C3.1 13.6 6.2 16 10 16s6.9-2.4 8.4-5.6a1 1 0 0 0 0-.8C16.9 6.4 13.8 4 10 4zm0 10c-2.9 0-5.4-1.8-6.7-4C4.6 7.8 7.1 6 10 6s5.4 1.8 6.7 4c-1.3 2.2-3.8 4-6.7 4z"
      />
      <circle cx="10" cy="10" r="2.2" fill="currentColor" />
    </svg>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-gris-500 uppercase">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words text-gris-900">{valor}</dd>
    </div>
  );
}

/*
  El comportamiento de teclado, foco y scroll vive en components/dialogo. Antes
  estaba aca a mano, y le faltaban la trampa de foco, la devolucion del foco al
  cerrar, el bloqueo del scroll de fondo, y detener la propagacion del Escape,
  que ademas de cerrar el modal sacaba al usuario del tutorial.
*/
function Modal({ activo, alCerrar }: { activo: GastoActivo; alCerrar: () => void }) {
  const sinDato = "Sin registrar";
  const equipo = [activo.marca, activo.modelo, activo.anio ? String(activo.anio) : null]
    .filter(Boolean)
    .join(" ");

  return (
    <Dialogo
      titulo={`Resumen de ${activo.codigo_interno} ${activo.nombre}`}
      alCerrar={alCerrar}
    >
      <>
        {/* El encabezado queda fijo: la ficha es larga y el boton de cerrar no
            puede quedar arriba fuera de alcance al bajar. */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gris-200 bg-blanco px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-widest text-primario uppercase">
              Resumen de la máquina
            </p>
            <h2 id="titulo-previsualizacion" className="mt-0.5 text-lg font-bold text-gris-900">
              {activo.codigo_interno} · {activo.nombre}
            </h2>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            className="-m-1 shrink-0 rounded p-1 text-sm font-semibold text-gris-500 hover:text-gris-900"
          >
            Cerrar
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Dato etiqueta="Tipo" valor={activo.tipo_nombre ?? sinDato} />
            <Dato etiqueta="Estado" valor={ETIQUETA_ESTADO_ACTIVO[activo.estado]} />
            <Dato etiqueta="Ubicación" valor={activo.ubicacion || sinDato} />
            <Dato etiqueta="Equipo" valor={equipo || sinDato} />
            {/* formateaHoras ya agrega la unidad. Concatenar otra daba "1.200 h h". */}
            <Dato etiqueta="Horómetro" valor={formateaHoras(activo.horometro_actual)} />
            <Dato
              etiqueta="Kilometraje"
              valor={
                activo.kilometraje_actual === null
                  ? sinDato
                  : `${formateaNumero(activo.kilometraje_actual)} km`
              }
            />
            <Dato etiqueta="Código" valor={activo.codigo_interno} />
          </dl>

          <div className="grid grid-cols-2 gap-3 border-t border-gris-200 pt-5 sm:grid-cols-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                Gasto total
              </p>
              <p className="mt-0.5 text-xl font-bold text-gris-900">
                {formateaPesos(activo.total)}
              </p>
            </div>
            <div>
              {/*
                "Completadas" y no "Mantenciones". La ficha del activo tiene otro
                tile llamado Mantenciones que cuenta TODAS las ordenes, de
                cualquier estado, y los dos numeros distintos con el mismo
                nombre hacian que la pantalla se contradijera sola.
              */}
              <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                Completadas
              </p>
              <p className="mt-0.5 text-xl font-bold text-gris-900">{activo.ordenes}</p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                Preventiva
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gris-900">
                {formateaPesos(activo.preventiva)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                Correctiva
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gris-900">
                {formateaPesos(activo.correctiva)}
              </p>
            </div>
            {/* Solo aparece si hay: un tile en cero por una categoria que esta
                flota no usa es ruido. Pero si hay plata ahi, tiene que verse, o
                los tres numeros no suman el total. */}
            {activo.otras > 0 ? (
              <div>
                <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                  Predictiva
                </p>
                <p className="mt-0.5 text-sm font-semibold text-gris-900">
                  {formateaPesos(activo.otras)}
                </p>
              </div>
            ) : null}
          </div>

          {activo.ultima_fecha ? (
            <p className="text-sm text-gris-600">
              Última mantención completada el {formateaFechaCorta(activo.ultima_fecha)}.
            </p>
          ) : null}

          <div className="border-t border-gris-200 pt-5">
            <SerieGasto puntos={activo.serie} mesesRecortados={activo.mesesRecortados} />
          </div>

          <div className="border-t border-gris-200 pt-5">
            <Link
              href={`/admin/activos/${activo.activo_id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90"
            >
              Abrir la ficha completa
            </Link>
          </div>
        </div>
      </>
    </Dialogo>
  );
}

export function GastoFlota({ panel }: { panel: PanelGasto }) {
  const [abierto, setAbierto] = useState<GastoActivo | null>(null);
  const cerrar = useCallback(() => setAbierto(null), []);

  if (panel.error) {
    return (
      <p role="alert" className="rounded-md border border-acento p-4 text-sm font-medium text-gris-900">
        No pude leer el gasto de la flota. Avisa a quien administra el sistema.
      </p>
    );
  }

  const conGasto = panel.activos.filter((a) => a.ordenes > 0);
  const visibles = conGasto.slice(0, MAXIMO_VISIBLE);
  const ocultos = conGasto.length - visibles.length;
  const mayor = Math.max(...visibles.map((a) => a.total), 1);

  return (
    <div className="space-y-4">
      {/* Dos numeros del mismo peso. El gasto sin la cantidad de ordenes no
          dice si la flota es cara o si simplemente se le hizo mucho trabajo. */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-lg">
        <div className="rounded-lg border border-gris-200 p-4">
          <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
            Gasto total
          </p>
          <p className="mt-0.5 text-2xl font-bold text-gris-900">{formateaPesos(panel.total)}</p>
        </div>
        <div className="rounded-lg border border-gris-200 p-4">
          <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
            Mantenciones completadas
          </p>
          <p className="mt-0.5 text-2xl font-bold text-gris-900">{panel.ordenes}</p>
        </div>
      </div>

      {conGasto.length === 0 ? (
        <p className="rounded-lg border border-gris-200 p-4 text-sm text-gris-600">
          Todavía no hay mantenciones completadas, así que no hay gasto que
          repartir por máquina.
        </p>
      ) : (
        <ul className="rounded-lg border border-gris-200">
          {visibles.map((a) => (
            <li
              key={a.activo_id}
              className="flex items-center gap-3 border-b border-gris-100 p-3 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-gris-900">
                    {a.codigo_interno} <span className="font-normal text-gris-600">· {a.nombre}</span>
                  </p>
                  <p className="shrink-0 text-sm font-bold text-gris-900">
                    {formateaPesos(a.total)}
                  </p>
                </div>

                {/* Una serie, un color. La barra repite la magnitud del monto
                    para poder comparar maquinas de un vistazo. */}
                <div className="mt-1.5 h-2 w-full border-b border-gris-200">
                  <div
                    className="h-full rounded-r bg-primario"
                    style={{ width: `${Math.max((a.total / mayor) * 100, 1)}%` }}
                    aria-hidden="true"
                  />
                </div>

                <p className="mt-1 text-xs text-gris-500">
                  {a.ordenes} {a.ordenes === 1 ? "mantención" : "mantenciones"}
                  {a.ultima_fecha ? ` · última el ${formateaFechaCorta(a.ultima_fecha)}` : ""}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAbierto(a)}
                aria-label={`Ver el resumen de ${a.codigo_interno} ${a.nombre}`}
                title="Ver resumen y gráfico de gastos"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-gris-300 text-gris-600 transition-colors hover:border-primario hover:text-primario"
              >
                <IconoOjo className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {ocultos > 0 || panel.sinGasto > 0 ? (
        <p className="text-xs text-gris-500">
          {ocultos > 0
            ? `Se muestran las ${MAXIMO_VISIBLE} máquinas de mayor gasto; quedan ${ocultos} más. `
            : ""}
          {panel.sinGasto > 0
            ? `${panel.sinGasto} ${
                panel.sinGasto === 1 ? "máquina no tiene" : "máquinas no tienen"
              } mantenciones completadas todavía.`
            : ""}
        </p>
      ) : null}

      {abierto ? <Modal activo={abierto} alCerrar={cerrar} /> : null}
    </div>
  );
}
