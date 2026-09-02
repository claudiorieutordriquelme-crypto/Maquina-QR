import Link from "next/link";
import { PERMISOS, perfilHabilitado } from "@/lib/auth";
import {
  ETIQUETA_ESTADO_ORDEN,
  listarOrdenes,
  listarProveedores,
  type EstadoOrden,
} from "@/lib/datos/mantenciones";
import { ETIQUETA_TIPO_MANTENCION, formateaFechaCorta, formateaPesos } from "@/lib/formato";
import type { TipoMantencion } from "@/lib/tipos";

/*
  Listado de ordenes de mantencion.

  Igual que en activos, los filtros van por querystring y en un form GET: el
  estado queda en la URL y se puede compartir o volver con el boton atras.

  A diferencia de activos, aca los filtros se aplican en la consulta y no en
  memoria. El historial de ordenes crece sin techo, una fila por intervencion de
  cada maquina para siempre, asi que traerlo entero para filtrarlo en JavaScript
  seria un problema en dos temporadas.
*/
export const dynamic = "force-dynamic";

const TIPOS: TipoMantencion[] = ["preventiva", "correctiva", "predictiva"];
const ESTADOS: EstadoOrden[] = ["programada", "en_ejecucion", "completada", "anulada"];

export default async function MantencionesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    estado?: string;
    proveedor?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const filtros = await searchParams;
  const [perfil, { ordenes, error }, proveedores] = await Promise.all([
    perfilHabilitado(),
    listarOrdenes(filtros),
    listarProveedores(),
  ]);

  const puedeOperar = perfil ? PERMISOS.operar.includes(perfil.rol) : false;
  const hayFiltros = Object.values(filtros).some(Boolean);
  const muestraCostos = ordenes.reduce((s, o) => s + Number(o.costo_total ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gris-900">Mantenciones</h1>
          <p className="mt-1 text-base text-gris-600">
            {ordenes.length} {ordenes.length === 1 ? "orden" : "órdenes"}
            {hayFiltros ? " con los filtros aplicados" : ""}
            {ordenes.length > 0 ? ` · ${formateaPesos(muestraCostos)} en total` : ""}
          </p>
        </div>

        {puedeOperar ? (
          <Link
            href="/admin/mantenciones/nueva"
            className="rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90"
          >
            Nueva mantención
          </Link>
        ) : null}
      </div>

      <form method="get" className="rounded-lg border border-gris-200 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-gris-500 uppercase">Tipo</span>
            <select
              name="tipo"
              defaultValue={filtros.tipo ?? ""}
              className="mt-1 w-full rounded-md border border-gris-300 px-3 py-2 text-sm text-gris-900"
            >
              <option value="">Todos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO_MANTENCION[t]}
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
                  {ETIQUETA_ESTADO_ORDEN[e]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
              Proveedor
            </span>
            <select
              name="proveedor"
              defaultValue={filtros.proveedor ?? ""}
              className="mt-1 w-full rounded-md border border-gris-300 px-3 py-2 text-sm text-gris-900"
            >
              <option value="">Todos</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-gris-500 uppercase">Desde</span>
            <input
              type="date"
              name="desde"
              defaultValue={filtros.desde ?? ""}
              className="mt-1 w-full rounded-md border border-gris-300 px-3 py-2 text-sm text-gris-900"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-gris-500 uppercase">Hasta</span>
            <input
              type="date"
              name="hasta"
              defaultValue={filtros.hasta ?? ""}
              className="mt-1 w-full rounded-md border border-gris-300 px-3 py-2 text-sm text-gris-900"
            />
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
              href="/admin/mantenciones"
              className="rounded-md border border-gris-300 px-4 py-2 text-sm font-semibold text-gris-800"
            >
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {error ? (
        <p role="alert" className="rounded-md border border-acento p-4 text-sm font-medium text-gris-900">
          No pude leer las órdenes: {error}
        </p>
      ) : ordenes.length === 0 ? (
        <p className="rounded-lg border border-gris-200 p-6 text-base text-gris-600">
          {hayFiltros ? "Ninguna orden cumple esos filtros." : "Todavía no hay mantenciones registradas."}
        </p>
      ) : (
        <ul className="space-y-3">
          {ordenes.map((o) => (
            <li key={o.id} className="rounded-lg border border-gris-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                    Folio {o.folio} · {ETIQUETA_TIPO_MANTENCION[o.tipo]} ·{" "}
                    {ETIQUETA_ESTADO_ORDEN[o.estado]}
                  </p>
                  <h2 className="text-lg font-bold text-gris-900">
                    {o.activo_codigo} · {o.activo_nombre}
                  </h2>
                  {o.plan_nombre ? (
                    <p className="mt-0.5 text-sm font-semibold text-gris-700">{o.plan_nombre}</p>
                  ) : null}
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold text-gris-900">
                    {formateaFechaCorta(o.fecha_ejecucion ?? o.fecha_programada)}
                  </p>
                  <p className="text-sm text-gris-600">{formateaPesos(o.costo_total)}</p>
                </div>
              </div>

              {o.descripcion_trabajo ? (
                <p className="mt-2 line-clamp-2 text-sm text-gris-700">{o.descripcion_trabajo}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gris-600">
                {o.proveedor_nombre ? <span>{o.proveedor_nombre}</span> : null}
                {o.ejecutor_interno ? <span>{o.ejecutor_interno}</span> : null}
                <Link
                  href={`/admin/mantenciones/${o.id}`}
                  className="font-semibold text-primario hover:underline"
                >
                  Ver detalle
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
