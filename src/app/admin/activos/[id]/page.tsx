import Link from "next/link";
import { notFound } from "next/navigation";
import { SerieGasto } from "@/components/graficos/serie-gasto";
import { PERMISOS, perfilHabilitado } from "@/lib/auth";
import { listarTiposActivo, obtenerDetalleActivo } from "@/lib/datos/activos";
import { cargarGastoDeActivo } from "@/lib/datos/reportes";
import {
  ETIQUETA_ESTADO_ACTIVO,
  PRESENTACION_SEMAFORO,
  formateaFechaCorta,
  formateaHoras,
  formateaNumero,
  formateaPesos,
  textoPlazo,
} from "@/lib/formato";
import { EditarActivo, ZonaBorrado } from "./piezas";

export const dynamic = "force-dynamic";

export default async function ActivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ activo, tipo_nombre, planes, lecturas, ordenes }, perfil, tipos, gasto] =
    await Promise.all([
      obtenerDetalleActivo(id),
      perfilHabilitado(),
      listarTiposActivo(),
      cargarGastoDeActivo(id),
    ]);

  if (!activo) notFound();

  const puedeAdministrar = perfil ? PERMISOS.administrar.includes(perfil.rol) : false;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/activos" className="text-sm font-semibold text-primario hover:underline">
          Volver a activos
        </Link>
        {tipo_nombre ? (
          <p className="mt-2 text-xs font-bold tracking-widest text-primario uppercase">
            {tipo_nombre}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-bold text-gris-900 sm:text-3xl">{activo.nombre}</h1>
        <p className="mt-0.5 text-base font-semibold text-gris-700">
          {[activo.codigo_interno, activo.patente].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/admin/activos/${activo.id}/qr`}
          className="rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90"
        >
          Ver e imprimir etiqueta QR
        </Link>
        <a
          href={`/a/${activo.qr_token}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800 transition-colors hover:border-gris-500"
        >
          Ver la ficha pública
        </a>
        <Link
          href="/admin/mantenciones/nueva"
          className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800 transition-colors hover:border-gris-500"
        >
          Registrar mantención
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { etiqueta: "Estado", valor: ETIQUETA_ESTADO_ACTIVO[activo.estado] },
          { etiqueta: "Ubicación", valor: activo.ubicacion ?? "Sin dato" },
          {
            etiqueta: "Horómetro",
            valor: activo.horometro_actual !== null ? formateaHoras(activo.horometro_actual) : "Sin dato",
          },
          { etiqueta: "Mantenciones", valor: `${ordenes}` },
        ].map((d) => (
          <div key={d.etiqueta} className="rounded-lg border border-gris-200 p-3">
            <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
              {d.etiqueta}
            </p>
            <p className="mt-0.5 text-base font-bold text-gris-900">{d.valor}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
          Planes de mantención
        </h2>

        {planes.length === 0 ? (
          <p className="rounded-lg border border-gris-200 p-4 text-sm text-gris-600">
            Este activo no tiene planes definidos, así que no aparece en el
            semáforo del resumen. Los planes todavía no se administran desde el
            panel: se cargan por base de datos.
          </p>
        ) : (
          <ul className="space-y-3">
            {planes.map((p) => {
              const pres = p.semaforo ? PRESENTACION_SEMAFORO[p.semaforo] : null;
              return (
                <li key={p.id} className="flex overflow-hidden rounded-lg border border-gris-200">
                  <div
                    className={`w-2 shrink-0 ${pres ? pres.barra : "bg-gris-200"}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-gris-900">{p.nombre}</h3>
                        <p className="mt-0.5 text-sm text-gris-600">
                          {[
                            p.intervalo_dias ? `cada ${p.intervalo_dias} días` : null,
                            p.intervalo_horas ? `cada ${formateaNumero(p.intervalo_horas)} h de uso` : null,
                          ]
                            .filter(Boolean)
                            .join(" y ")}
                          {!p.activo ? " · plan inactivo" : ""}
                        </p>
                      </div>

                      {pres ? (
                        <span
                          className={`shrink-0 rounded px-2 py-1 text-xs font-bold tracking-wide uppercase ${pres.insignia}`}
                        >
                          {pres.etiqueta}
                        </span>
                      ) : null}
                    </div>

                    {p.semaforo ? (
                      <p className="mt-2 text-base font-semibold text-gris-800">
                        {textoPlazo({
                          plan: p.nombre,
                          proxima_fecha: p.proxima_fecha,
                          semaforo: p.semaforo,
                          dias_restantes: p.dias_restantes,
                          disparador: p.disparador,
                          horas_restantes: p.horas_restantes,
                        })}
                      </p>
                    ) : null}

                    {p.descripcion_tareas ? (
                      <p className="mt-1 text-sm text-gris-600">{p.descripcion_tareas}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/*
        El gasto va despues de los planes y antes de las lecturas. El orden de
        esta ficha es: que le toca, cuanto ha costado, y como se ha usado.
      */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
            Gasto de mantención
          </h2>
          <Link
            href="/admin/reportes"
            className="text-sm font-semibold text-primario hover:underline"
          >
            Comparar con la flota
          </Link>
        </div>

        {gasto.error ? (
          <p
            role="alert"
            className="rounded-md border border-acento p-4 text-sm font-medium text-gris-900"
          >
            No pude leer el gasto de esta máquina. Es un problema de lectura, no
            que no tenga mantenciones: avisa a quien administra el sistema.
          </p>
        ) : gasto.ordenes === 0 ? (
          <p className="rounded-lg border border-gris-200 p-4 text-sm text-gris-600">
            Esta máquina no tiene mantenciones completadas, así que todavía no ha
            costado nada. Una orden programada no cuenta hasta que se completa y
            se le pone fecha de ejecución.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-gris-200 p-4">
                <dt className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                  Gasto total
                </dt>
                <dd className="mt-0.5 text-xl font-bold text-gris-900">
                  {formateaPesos(gasto.total)}
                </dd>
              </div>
              <div className="rounded-lg border border-gris-200 p-4">
                <dt className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                  Mantenciones
                </dt>
                <dd className="mt-0.5 text-xl font-bold text-gris-900">{gasto.ordenes}</dd>
              </div>
              <div className="rounded-lg border border-gris-200 p-4">
                <dt className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                  Preventiva
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-gris-900">
                  {formateaPesos(gasto.preventiva)}
                </dd>
              </div>
              <div className="rounded-lg border border-gris-200 p-4">
                <dt className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                  Correctiva
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-gris-900">
                  {formateaPesos(gasto.correctiva)}
                </dd>
              </div>
            </dl>

            <SerieGasto puntos={gasto.serie} mesesRecortados={gasto.mesesRecortados} />
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
          Últimas lecturas de uso
        </h2>

        {lecturas.length === 0 ? (
          <p className="rounded-lg border border-gris-200 p-4 text-sm text-gris-600">
            Sin lecturas registradas. Sin ellas, los planes por horas de uso
            detectan el vencimiento pero no pueden anticiparlo en días.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gris-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gris-200 text-left text-xs font-semibold tracking-wide text-gris-500 uppercase">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2 text-right">Horómetro</th>
                  <th className="px-3 py-2 text-right">Kilometraje</th>
                </tr>
              </thead>
              <tbody>
                {lecturas.map((l) => (
                  <tr key={l.id} className="border-b border-gris-100 last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap text-gris-700">
                      {formateaFechaCorta(l.fecha)}
                    </td>
                    <td className="px-3 py-2 text-right text-gris-900">
                      {l.horometro !== null ? formateaHoras(l.horometro) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-gris-900">
                      {l.kilometraje !== null ? `${formateaNumero(l.kilometraje)} km` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {activo.valor_adquisicion !== null || activo.fecha_adquisicion !== null ? (
        <section>
          <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">Adquisición</h2>
          <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-sm text-gris-600">
            {activo.fecha_adquisicion ? (
              <div className="flex gap-1">
                <dt className="font-semibold">Fecha:</dt>
                <dd>{formateaFechaCorta(activo.fecha_adquisicion)}</dd>
              </div>
            ) : null}
            {activo.valor_adquisicion !== null ? (
              <div className="flex gap-1">
                <dt className="font-semibold">Valor:</dt>
                <dd>{formateaPesos(activo.valor_adquisicion)}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {puedeAdministrar ? (
        <>
          <section className="space-y-3 border-t border-gris-200 pt-6">
            <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
              Editar el activo
            </h2>
            <EditarActivo activo={activo} tipos={tipos} />
          </section>

          <section className="border-t border-gris-200 pt-6">
            <ZonaBorrado
              activo={activo}
              ordenes={ordenes}
              planes={planes.length}
              lecturas={lecturas.length}
            />
          </section>
        </>
      ) : (
        <p className="border-t border-gris-200 pt-6 text-sm text-gris-500">
          Tu rol permite ver este activo pero no editarlo ni borrarlo.
        </p>
      )}
    </div>
  );
}
