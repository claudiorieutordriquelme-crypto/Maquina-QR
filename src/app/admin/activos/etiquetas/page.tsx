import Link from "next/link";
import { BotonImprimir } from "@/components/boton-imprimir";
import { EtiquetaQr } from "@/components/etiqueta-qr";
import { listarParaEtiquetas } from "@/lib/datos/activos";
import { baseParaQr } from "@/lib/qr";

/*
  Impresion de etiquetas, con seleccion por activo y copias por activo.

  Sirve para dar de alta una flota completa de una pasada y tambien para
  reimprimir tres etiquetas sueltas, que es el caso mas frecuente despues del
  primer dia: una se despego, otra quedo ilegible, otra maquina llego nueva.

  La seleccion viaja por querystring y no en estado de cliente, por tres razones
  concretas: el link de una tanda de impresion se puede guardar y repetir, el
  boton atras del navegador funciona, y la pagina sigue sin JavaScript propio
  salvo el window.print().

  Convencion de los parametros:
    sel ausente        -> se imprimen todos los activos operativos
    sel presente       -> se imprimen solo los ids que vengan, y ninguno si viene vacio
    copias_<id>        -> cuantas veces repetir esa etiqueta, entre 1 y 20

  Los activos dados de baja no aparecen: su ficha publica responde 404, asi que
  imprimir su etiqueta seria imprimir un codigo que no lleva a ninguna parte.
*/
export const dynamic = "force-dynamic";

const COPIAS_MAXIMAS = 20;

function comoLista(valor: string | string[] | undefined): string[] {
  if (valor === undefined) return [];
  return (Array.isArray(valor) ? valor : [valor]).filter((v) => v.length > 0);
}

export default async function EtiquetasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [activos, { base, origen }] = await Promise.all([listarParaEtiquetas(), baseParaQr()]);

  // La presencia de la clave, no su contenido, es lo que distingue "todos" de
  // "ninguno". Sin eso no habria forma de pedir cero etiquetas.
  const haySeleccion = Object.prototype.hasOwnProperty.call(params, "sel");
  const seleccionados = new Set(comoLista(params.sel));

  const copiasDe = (id: string): number => {
    const bruto = params[`copias_${id}`];
    const valor = Array.isArray(bruto) ? bruto[0] : bruto;
    const n = Number.parseInt(valor ?? "1", 10);
    if (!Number.isFinite(n)) return 1;
    return Math.min(Math.max(n, 1), COPIAS_MAXIMAS);
  };

  const elegidos = activos.filter((a) => (haySeleccion ? seleccionados.has(a.id) : true));

  // Una entrada por copia. Se arma aca para que el contador del boton diga la
  // cantidad de etiquetas que van a salir, no la cantidad de activos elegidos.
  const aImprimir = elegidos.flatMap((a) =>
    Array.from({ length: copiasDe(a.id) }, (_, i) => ({ activo: a, copia: i })),
  );

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link href="/admin/activos" className="text-sm font-semibold text-primario hover:underline">
          Volver a activos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gris-900">Impresión de etiquetas</h1>
        <p className="mt-1 max-w-prose text-base text-gris-600">
          Elige qué activos imprimir y cuántas copias de cada uno. Entran seis
          etiquetas por hoja tamaño carta.
        </p>
      </div>

      <div className="rounded-lg border border-gris-200 p-4 print:hidden" data-tour="etiquetas-base">
        <p className="text-xs font-bold tracking-widest text-gris-500 uppercase">
          Todos los códigos apuntan a
        </p>
        <p className="mt-1 font-mono text-sm break-all text-gris-900">{base}/a/…</p>
        <p className="mt-2 text-sm text-gris-600">
          Base tomada de la {origen}.{" "}
          <span className="font-semibold text-gris-900">Revísala antes de imprimir.</span> Si el
          dominio cambia después, hay que reimprimir y volver a pegar cada etiqueta, una por una.
        </p>
      </div>

      {activos.length === 0 ? (
        <p className="rounded-lg border border-gris-200 p-6 text-base text-gris-600 print:hidden">
          No hay activos operativos que etiquetar.
        </p>
      ) : (
        <form method="get" className="rounded-lg border border-gris-200 print:hidden" data-tour="etiquetas-seleccion">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gris-200 p-4">
            <div>
              <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
                Qué imprimir
              </h2>
              <p className="mt-1 text-sm text-gris-600">
                {elegidos.length} de {activos.length}{" "}
                {activos.length === 1 ? "activo" : "activos"} seleccionados ·{" "}
                {aImprimir.length} {aImprimir.length === 1 ? "etiqueta" : "etiquetas"} en total
              </p>
            </div>

            {/* Todos y ninguno son enlaces y no botones: cambian la URL, que es
                donde vive la seleccion, sin necesitar JavaScript. */}
            <div className="flex flex-wrap gap-3 text-sm font-semibold">
              <Link href="/admin/activos/etiquetas" className="text-primario hover:underline">
                Seleccionar todos
              </Link>
              <Link href="/admin/activos/etiquetas?sel=" className="text-primario hover:underline">
                Ninguno
              </Link>
            </div>
          </div>

          <ul className="divide-y divide-gris-100">
            {activos.map((a) => {
              const marcado = haySeleccion ? seleccionados.has(a.id) : true;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <label className="flex min-w-0 flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      name="sel"
                      value={a.id}
                      defaultChecked={marcado}
                      className="size-4 shrink-0 accent-primario"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-gris-900">
                        {a.codigo_interno}
                      </span>
                      <span className="block truncate text-sm text-gris-600">{a.nombre}</span>
                    </span>
                  </label>

                  <label className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                      Copias
                    </span>
                    <input
                      type="number"
                      name={`copias_${a.id}`}
                      min={1}
                      max={COPIAS_MAXIMAS}
                      step={1}
                      defaultValue={copiasDe(a.id)}
                      className="w-16 rounded-md border border-gris-300 px-2 py-1.5 text-sm text-gris-900"
                    />
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-3 border-t border-gris-200 p-4">
            <button
              type="submit"
              className="rounded-md border border-primario px-4 py-2.5 text-sm font-semibold text-primario transition-colors hover:bg-primario hover:text-blanco"
            >
              Actualizar la vista previa
            </button>
            <p className="text-sm text-gris-500">
              La vista previa de abajo es exactamente lo que sale de la impresora.
            </p>
          </div>
        </form>
      )}

      {aImprimir.length > 0 ? (
        <>
          <div className="print:hidden">
            <BotonImprimir
              etiqueta={`Imprimir ${aImprimir.length} ${
                aImprimir.length === 1 ? "etiqueta" : "etiquetas"
              }`}
            />
          </div>

          <div className="zona-impresion flex flex-wrap gap-[4mm]">
            {aImprimir.map(({ activo, copia }) => (
              <EtiquetaQr
                key={`${activo.id}-${copia}`}
                base={base}
                nombre={activo.nombre}
                codigoInterno={activo.codigo_interno}
                token={activo.qr_token}
              />
            ))}
          </div>
        </>
      ) : activos.length > 0 ? (
        <p className="rounded-lg border border-gris-200 p-6 text-base text-gris-600 print:hidden">
          No hay etiquetas seleccionadas. Marca al menos un activo y aprieta
          &quot;Actualizar la vista previa&quot;.
        </p>
      ) : null}
    </div>
  );
}
