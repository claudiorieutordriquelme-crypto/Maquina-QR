import Link from "next/link";
import { GlifoSemaforo } from "@/components/glifo-semaforo";
import { PRESENTACION_SEMAFORO, formateaFechaCorta, textoPlazo } from "@/lib/formato";
import type { FilaCriticidad } from "@/lib/datos/reportes";

/*
  Tabla de planes ordenada por criticidad.

  Es una tabla y no un grafico a proposito. El trabajo de este dato no es
  mostrar magnitud ni proporcion: es una lista de trabajo pendiente, y cada fila
  necesita una accion. Un grafico de barras de "dias restantes por plan" se veria
  bien y no serviria para nada, porque nadie puede hacer clic en una barra para
  registrar la mantencion.

  El resumen antes decia "hay 3 vencidas" sin decir cuales. Esta tabla es la
  diferencia entre un contador y una herramienta.

  El boton de cada fila lleva el activo y el plan en la direccion, asi que el
  formulario de mantencion se abre con los dos ya elegidos. Ese es el atajo que
  hace util la lista: de "esto esta vencido" a "registrando la mantencion" en un
  clic, sin volver a buscar la maquina en un desplegable de cuarenta.
*/
export function TablaCriticidad({
  filas,
  puedeOperar,
  limite = 12,
}: {
  filas: FilaCriticidad[];
  puedeOperar: boolean;
  limite?: number;
}) {
  if (filas.length === 0) {
    return (
      <p className="rounded-lg border border-gris-200 p-4 text-sm text-gris-600">
        No hay planes de mantención definidos, así que no hay nada que ordenar por
        criticidad.
      </p>
    );
  }

  const visibles = filas.slice(0, limite);
  const ocultas = filas.length - visibles.length;

  const plazo = (f: FilaCriticidad) =>
    textoPlazo({
      plan: f.plan_nombre,
      proxima_fecha: f.proxima_fecha,
      semaforo: f.semaforo,
      dias_restantes: f.dias_restantes,
      disparador: f.disparador,
      horas_restantes: f.horas_restantes,
    });

  const destino = (f: FilaCriticidad) =>
    `/admin/mantenciones/nueva?activo=${f.activo_id}&plan=${f.plan_id}`;

  return (
    <div>
      {/* Bajo 640 px, tarjetas: cinco columnas mas la accion no caben en un
          telefono, y el panel se usa desde el celular en terreno. */}
      <ul className="space-y-2 sm:hidden">
        {visibles.map((f) => {
          const p = PRESENTACION_SEMAFORO[f.semaforo];
          return (
            <li
              key={f.plan_id}
              className="flex overflow-hidden rounded-lg border border-gris-200"
            >
              <div className={`w-2 shrink-0 ${p.barra}`} aria-hidden="true" />
              <div className="min-w-0 flex-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-bold text-gris-900">
                    {f.codigo_interno} · {f.activo_nombre}
                  </p>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold tracking-wide uppercase ${p.insignia}`}
                  >
                    <GlifoSemaforo estado={f.semaforo} className="size-3 shrink-0" />
                    {p.etiqueta}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-gris-700">{f.plan_nombre}</p>
                <p className="mt-1 text-sm font-semibold text-gris-900">{plazo(f)}</p>
                {puedeOperar ? (
                  <Link
                    href={destino(f)}
                    className="mt-2 inline-block text-sm font-semibold text-primario hover:underline"
                  >
                    Registrar mantención
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border border-gris-200 sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gris-200 text-left text-xs font-semibold tracking-wide text-gris-500 uppercase">
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Activo</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Plazo</th>
              <th className="px-3 py-2">Fecha</th>
              {puedeOperar ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => {
              const p = PRESENTACION_SEMAFORO[f.semaforo];
              return (
                <tr key={f.plan_id} className="border-b border-gris-100 last:border-0">
                  <td className="px-3 py-2">
                    {/* Insignia con glifo: el estado nunca se comunica solo por
                        color, y aca vencida y critica comparten la tinta. */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-bold tracking-wide whitespace-nowrap uppercase ${p.insignia}`}
                    >
                      <GlifoSemaforo estado={f.semaforo} className="size-3.5 shrink-0" />
                      {p.etiqueta}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-semibold text-gris-900">
                    {f.codigo_interno}
                    <span className="font-normal text-gris-600"> · {f.activo_nombre}</span>
                  </td>
                  <td className="px-3 py-2 text-gris-700">{f.plan_nombre}</td>
                  <td className="px-3 py-2 font-medium text-gris-900">{plazo(f)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gris-600">
                    {f.proxima_fecha ? formateaFechaCorta(f.proxima_fecha) : "—"}
                  </td>
                  {puedeOperar ? (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Link
                        href={destino(f)}
                        className="font-semibold text-primario hover:underline"
                      >
                        Registrar
                      </Link>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Un corte que no se declara se lee como "esto es todo". */}
      {ocultas > 0 ? (
        <p className="mt-2 text-xs text-gris-500">
          Se muestran los {limite} planes más críticos. Quedan {ocultas} más; se ven en
          Activos filtrando por semáforo.
        </p>
      ) : null}
    </div>
  );
}
