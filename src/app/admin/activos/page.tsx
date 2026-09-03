import Link from "next/link";
import { BotonBorrarActivo } from "@/components/borrar-activo";
import { listarActivos, listarTiposActivo } from "@/lib/datos/activos";
import { perfilHabilitado, PERMISOS } from "@/lib/auth";
import { ETIQUETA_ESTADO_ACTIVO, PRESENTACION_SEMAFORO, formateaHoras } from "@/lib/formato";
import type { Semaforo } from "@/lib/tipos";

/*
  Listado de activos con filtros.

  Los filtros van por querystring y en un <form method="get">, sin JavaScript:
  el estado del filtro queda en la URL, asi que se puede compartir un link a
  "todo lo vencido en el fundo El Roble" y se puede volver con el boton atras.
  Un filtro en estado de React no permite ninguna de las dos cosas.
*/
export const dynamic = "force-dynamic";

const SEMAFOROS: Semaforo[] = ["vencida", "critica", "proxima", "al_dia", "sin_linea_base"];
const ESTADOS = ["operativo", "en_mantencion", "fuera_servicio", "dado_de_baja"] as const;

export default async function ActivosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; estado?: string; ubicacion?: string; semaforo?: string }>;
}) {
  const filtros = await searchParams;
  const perfil = await perfilHabilitado();
  const [{ activos, ubicaciones, error }, tipos] = await Promise.all([
    listarActivos(filtros),
    listarTiposActivo(),
  ]);

  const puedeAdministrar = perfil ? PERMISOS.administrar.includes(perfil.rol) : false;
  const hayFiltros = Object.values(filtros).some(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gris-900">Activos</h1>
          <p className="mt-1 text-base text-gris-600">
            {activos.length} {activos.length === 1 ? "activo" : "activos"}
            {hayFiltros ? " con los filtros aplicados" : " en la flota"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/activos/etiquetas"
            className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800 transition-colors hover:border-gris-500"
          >
            Imprimir etiquetas
          </Link>
          {puedeAdministrar ? (
            <Link
              href="/admin/activos/nuevo"
              data-tour="activos-nuevo"
              className="rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90"
            >
              Nuevo activo
            </Link>
          ) : null}
        </div>
      </div>

      <form method="get" className="rounded-lg border border-gris-200 p-4" data-tour="activos-filtros">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-gris-500 uppercase">Tipo</span>
            <select
              name="tipo"
              defaultValue={filtros.tipo ?? ""}
              className="mt-1 w-full rounded-md border border-gris-300 px-3 py-2 text-sm text-gris-900"
            >
              <option value="">Todos</option>
              {tipos.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-gris-500 uppercase">Estado</span>
            <select
              name="estado"
              defaultValue={filtros.estado ?? ""}
              className="mt-1 w-full rounded-md border border-gris-300 px-3 py-2 text-sm text-gris-900"
            >
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO_ACTIVO[e]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
              Ubicación
            </span>
            <select
              name="ubicacion"
              defaultValue={filtros.ubicacion ?? ""}
              className="mt-1 w-full rounded-md border border-gris-300 px-3 py-2 text-sm text-gris-900"
            >
              <option value="">Todas</option>
              {ubicaciones.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
              Semáforo
            </span>
            <select
              name="semaforo"
              defaultValue={filtros.semaforo ?? ""}
              className="mt-1 w-full rounded-md border border-gris-300 px-3 py-2 text-sm text-gris-900"
            >
              <option value="">Todos</option>
              {SEMAFOROS.map((s) => (
                <option key={s} value={s}>
                  {PRESENTACION_SEMAFORO[s].etiqueta}
                </option>
              ))}
              {/* El caso mas riesgoso, una maquina sin ningun plan que calcular,
                  era el unico que no se podia filtrar. */}
              <option value="sin_planes">Sin planes</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-md bg-primario px-4 py-2 text-sm font-semibold text-blanco transition-opacity hover:opacity-90"
          >
            Filtrar
          </button>
          {hayFiltros ? (
            <Link
              href="/admin/activos"
              className="rounded-md border border-gris-300 px-4 py-2 text-sm font-semibold text-gris-800"
            >
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {error ? (
        <p role="alert" className="rounded-md border border-acento p-4 text-sm font-medium text-gris-900">
          No pude leer los activos. Avisa a quien administra el sistema; el
          detalle quedó en el registro del servidor.
        </p>
      ) : activos.length === 0 ? (
        <p className="rounded-lg border border-gris-200 p-6 text-base text-gris-600">
          {hayFiltros
            ? "Ningún activo cumple esos filtros."
            : "Todavía no hay activos cargados."}
        </p>
      ) : (
        <ul className="space-y-3" data-tour="activos-lista">
          {activos.map((a) => {
            const p = a.semaforo ? PRESENTACION_SEMAFORO[a.semaforo] : null;
            return (
              <li key={a.id} className="flex overflow-hidden rounded-lg border border-gris-200">
                <div
                  className={`w-2 shrink-0 ${p ? p.barra : "bg-gris-200"}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                        {a.tipo_nombre ?? a.tipo_codigo}
                      </p>
                      <h2 className="text-lg font-bold text-gris-900">{a.nombre}</h2>
                      <p className="mt-0.5 text-sm font-semibold text-gris-700">
                        {[a.codigo_interno, a.patente].filter(Boolean).join(" · ")}
                      </p>
                    </div>

                    {p ? (
                      <span
                        className={`shrink-0 rounded px-2 py-1 text-xs font-bold tracking-wide uppercase ${p.insignia}`}
                      >
                        {p.etiqueta}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded border border-gris-300 px-2 py-1 text-xs font-bold tracking-wide text-gris-500 uppercase">
                        Sin planes
                      </span>
                    )}
                  </div>

                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gris-600">
                    <div className="flex gap-1">
                      <dt className="font-semibold">Estado:</dt>
                      <dd>{ETIQUETA_ESTADO_ACTIVO[a.estado]}</dd>
                    </div>
                    {a.ubicacion ? (
                      <div className="flex gap-1">
                        <dt className="font-semibold">Ubicación:</dt>
                        <dd>{a.ubicacion}</dd>
                      </div>
                    ) : null}
                    {a.horometro_actual !== null ? (
                      <div className="flex gap-1">
                        <dt className="font-semibold">Horómetro:</dt>
                        <dd>{formateaHoras(a.horometro_actual)}</dd>
                      </div>
                    ) : null}
                    <div className="flex gap-1">
                      <dt className="font-semibold">Planes:</dt>
                      {/* Se muestran los dos numeros cuando difieren. Un plan
                          desactivado existe pero no calcula semaforo, y esconder
                          esa diferencia era lo que hacia que el borrado
                          prometiera llevarse menos de lo que se llevaba. */}
                      <dd>
                        {a.planesTotales}
                        {a.planesTotales !== a.planes ? (
                          <span className="text-gris-500">
                            {" "}
                            ({a.planes} con semáforo)
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
                    <Link href={`/admin/activos/${a.id}`} className="text-primario hover:underline">
                      Ver y editar
                    </Link>
                    <Link href={`/admin/activos/${a.id}/qr`} className="text-primario hover:underline">
                      Etiqueta QR
                    </Link>
                    <a
                      href={`/a/${a.qr_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primario hover:underline"
                    >
                      Ver ficha pública
                    </a>

                    {/*
                      El borrado aparece con TRES condiciones, y la tercera es la
                      que faltaba: hay que haber podido CONTAR. Si la consulta de
                      ordenes falla o vuelve cortada, conteoOrdenesFiable es
                      false y no se ofrece el borrado, porque afirmar "esta
                      maquina no tiene historial" sin haber contado es la mentira
                      que provoca una perdida de datos.

                      Las otras dos: ser administrador, y que la maquina no tenga
                      mantenciones. Con historial la llave foranea RESTRICT lo
                      rechaza siempre, y un boton que va a fallar manda a pelear
                      con el sistema en vez de mostrar la salida real, que es
                      darla de baja desde su ficha.

                      Se pasa planesTotales y no planes: el primero cuenta todos,
                      incluidos los desactivados, que es lo que el CASCADE se
                      lleva de verdad.
                    */}
                    {puedeAdministrar && a.conteoOrdenesFiable && a.ordenes === 0 ? (
                      <BotonBorrarActivo
                        activoId={a.id}
                        codigoInterno={a.codigo_interno}
                        nombre={a.nombre}
                        planes={a.planesTotales}
                      />
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
