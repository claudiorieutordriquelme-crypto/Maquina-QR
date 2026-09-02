import Link from "next/link";
import { BarraProporcion } from "@/components/graficos/barra-proporcion";
import { BarrasCosto } from "@/components/graficos/barras-costo";
import { cargarReportes, type CorteCosto } from "@/lib/datos/reportes";
import { formateaPesos } from "@/lib/formato";

/*
  Reportes de costo de mantención.

  UN SOLO FILTRO ARRIBA, no uno por gráfico. Los tres cortes miran el mismo
  período: si cada tarjeta trajera su propio rango de fechas, dos gráficos
  vecinos podrían estar contando cosas distintas sin que nadie lo note.

  Cada gráfico tiene su tabla gemela debajo. Eso no es redundancia: el verde
  claro de la barra de proporción queda en 1,99:1 de contraste contra el fondo,
  y la guía de visualización obliga a etiquetas visibles o vista de tabla cuando
  eso pasa. Van las dos, así que ningún valor depende de distinguir un color.
*/
export const dynamic = "force-dynamic";

function TablaCorte({
  titulo,
  encabezado,
  filas,
  total,
}: {
  titulo: string;
  encabezado: string;
  filas: CorteCosto[];
  total: number;
}) {
  if (filas.length === 0) return null;

  return (
    <details className="rounded-lg border border-gris-200">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gris-800 marker:text-primario">
        {titulo}
      </summary>

      <div className="overflow-x-auto border-t border-gris-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gris-200 text-left text-xs font-semibold tracking-wide text-gris-500 uppercase">
              <th className="px-3 py-2">{encabezado}</th>
              <th className="px-3 py-2 text-right">Órdenes</th>
              <th className="px-3 py-2 text-right">Costo</th>
              <th className="px-3 py-2 text-right">Participación</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave} className="border-b border-gris-100 last:border-0">
                <td className="px-3 py-2 font-medium text-gris-900">{f.etiqueta}</td>
                <td className="px-3 py-2 text-right text-gris-700">{f.ordenes}</td>
                <td className="px-3 py-2 text-right font-semibold text-gris-900">
                  {formateaPesos(f.costo)}
                </td>
                <td className="px-3 py-2 text-right text-gris-700">
                  {total > 0 ? `${((f.costo / total) * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;
  /*
    No se vuelve a mirar el rol aca: el layout del panel ya exigio sesion y
    perfil habilitado, y los tres roles tienen permiso de lectura. Lo que
    aparece en el reporte lo decide RLS, porque cada consulta va con la sesion
    de quien mira. El endpoint del CSV si verifica por su cuenta, porque se
    puede pedir directo sin pasar por esta pantalla.
  */
  const r = await cargarReportes({ desde, hasta });
  const consulta = new URLSearchParams();
  if (desde) consulta.set("desde", desde);
  if (hasta) consulta.set("hasta", hasta);
  const sufijo = consulta.toString() ? `&${consulta.toString()}` : "";
  const hayPeriodo = Boolean(desde || hasta);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gris-900">Reportes</h1>
        <p className="mt-1 max-w-prose text-base text-gris-600">
          Costo de mantención por activo, por tipo y por proveedor. Solo cuenta
          órdenes completadas con fecha de ejecución: una orden programada
          todavía no costó nada.
        </p>
      </div>

      {/* Un filtro para todo lo que sigue. */}
      <form method="get" className="rounded-lg border border-gris-200 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
              Desde
            </span>
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              className="mt-1 w-full rounded-md border border-gris-300 px-3 py-2 text-sm text-gris-900"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
              Hasta
            </span>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              className="mt-1 w-full rounded-md border border-gris-300 px-3 py-2 text-sm text-gris-900"
            />
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-md bg-primario px-4 py-2 text-sm font-semibold text-blanco transition-opacity hover:opacity-90"
            >
              Aplicar
            </button>
            {hayPeriodo ? (
              <Link
                href="/admin/reportes"
                className="rounded-md border border-gris-300 px-4 py-2 text-sm font-semibold text-gris-800"
              >
                Todo el historial
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      {r.error ? (
        <p role="alert" className="rounded-md border border-acento p-4 text-sm font-medium text-gris-900">
          No pude leer los datos de costo. Avisa a quien administra el sistema.
        </p>
      ) : r.totalOrdenes === 0 ? (
        <p className="rounded-lg border border-gris-200 p-6 text-base text-gris-600">
          {hayPeriodo
            ? "No hay mantenciones completadas en ese período."
            : "Todavía no hay mantenciones completadas que reportar."}
        </p>
      ) : (
        <>
          {/* Dos tiles, no un numero heroe: el costo sin el conteo de ordenes
              no dice nada, y dos numeros del mismo peso se comparan mejor. */}
          <section className="grid grid-cols-2 gap-3 sm:max-w-lg">
            <div className="rounded-lg border border-gris-200 p-4">
              <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                Costo del período
              </p>
              <p className="mt-0.5 text-2xl font-bold text-gris-900">
                {formateaPesos(r.totalCosto)}
              </p>
            </div>
            <div className="rounded-lg border border-gris-200 p-4">
              <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                Órdenes completadas
              </p>
              <p className="mt-0.5 text-2xl font-bold text-gris-900">{r.totalOrdenes}</p>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
                Preventiva contra correctiva
              </h2>
              <a
                href={`/admin/reportes/csv?corte=tipo${sufijo}`}
                className="text-sm font-semibold text-primario hover:underline"
              >
                Descargar CSV
              </a>
            </div>

            <BarraProporcion datos={r.porTipo} />

            <p className="max-w-prose text-sm text-gris-600">
              Las dos barras miden lo mismo de dos maneras, y la diferencia entre
              ellas es el dato: si la correctiva pesa más en costo que en cantidad
              de órdenes, cada falla no planificada está saliendo más cara que una
              mantención programada. Eso es lo que justifica invertir en
              preventiva.
            </p>

            <TablaCorte
              titulo="Ver los números por tipo"
              encabezado="Tipo"
              filas={r.porTipo}
              total={r.totalCosto}
            />
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
                Costo por activo
              </h2>
              <a
                href={`/admin/reportes/csv?corte=activo${sufijo}`}
                className="text-sm font-semibold text-primario hover:underline"
              >
                Descargar CSV
              </a>
            </div>

            <BarrasCosto datos={r.porActivo} limite={10} />

            <TablaCorte
              titulo="Ver los números por activo"
              encabezado="Activo"
              filas={r.porActivo}
              total={r.totalCosto}
            />
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
                Costo por proveedor
              </h2>
              <a
                href={`/admin/reportes/csv?corte=proveedor${sufijo}`}
                className="text-sm font-semibold text-primario hover:underline"
              >
                Descargar CSV
              </a>
            </div>

            <BarrasCosto datos={r.porProveedor} limite={10} />

            <TablaCorte
              titulo="Ver los números por proveedor"
              encabezado="Proveedor"
              filas={r.porProveedor}
              total={r.totalCosto}
            />
          </section>

          <p className="border-t border-gris-200 pt-6 text-sm text-gris-500">
            El CSV sale con punto y coma como separador y con marca de UTF-8, para
            que Excel en configuración chilena lo abra en columnas y con los
            acentos correctos. Los montos van sin símbolo de moneda ni separador
            de miles, así que se pueden sumar en la planilla.
          </p>
        </>
      )}
    </div>
  );
}
