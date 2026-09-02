import { formateaPesos } from "@/lib/formato";
import type { CorteCosto } from "@/lib/datos/reportes";

/*
  Barras horizontales de costo por identidad (activo, proveedor).

  Por que un solo color y no un degradado por magnitud: pintar cada barra mas
  oscura donde es mas grande codifica dos veces el largo de la barra, quema el
  unico canal libre en informacion que el grafico ya muestra, y falla los
  chequeos de paleta categorica por diseno. Una serie, un color.

  Por que marcas en HTML y CSS en vez de SVG: se renderizan igual en el
  servidor, sin librerias, y responden al ancho del contenedor sin calcular un
  viewBox. El borde redondeado solo en el extremo del dato, cuadrado en la
  linea base, sale directo con border-radius. Con texto de etiquetas de largo
  variable, el SVG obligaria a medir tipografia a mano.

  Especificaciones que se respetan: marca de 18 px de grosor (el tope es 24),
  extremo del dato redondeado en 4 px y cuadrado en la base, linea base de un
  pixel en gris recesivo, y el valor al extremo de cada barra en tinta de texto
  y nunca en el color de la serie.

  El valor va en TODAS las barras y no selectivamente porque aca reemplaza al
  eje: sin eje horizontal, la etiqueta directa es el unico lugar donde se lee el
  numero. La regla de etiquetar poco aplica cuando existe un eje que carga el
  resto.
*/
export function BarrasCosto({
  datos,
  limite = 10,
  vacio = "Sin datos en el período.",
}: {
  datos: CorteCosto[];
  limite?: number;
  vacio?: string;
}) {
  if (datos.length === 0) {
    return <p className="rounded-lg border border-gris-200 p-4 text-sm text-gris-600">{vacio}</p>;
  }

  const visibles = datos.slice(0, limite);
  const maximo = Math.max(...visibles.map((d) => d.costo), 1);
  const ocultos = datos.length - visibles.length;

  return (
    <div>
      <ul className="space-y-3">
        {visibles.map((d) => {
          const porcentaje = Math.max((d.costo / maximo) * 100, 0.5);
          return (
            <li key={d.clave}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold text-gris-800">{d.etiqueta}</p>
                {/* Valor en tinta de texto, no en el color de la serie. */}
                <p className="shrink-0 text-sm font-bold text-gris-900">
                  {formateaPesos(d.costo)}
                </p>
              </div>

              <div
                className="mt-1 h-[18px] w-full border-b border-gris-200"
                role="img"
                aria-label={`${d.etiqueta}: ${formateaPesos(d.costo)} en ${d.ordenes} ${
                  d.ordenes === 1 ? "orden" : "órdenes"
                }`}
              >
                {/* Extremo del dato redondeado, base cuadrada: la barra crece
                    desde la izquierda y solo ese extremo lleva radio. */}
                <div
                  className="h-full rounded-r bg-primario"
                  style={{ width: `${porcentaje}%` }}
                  title={`${d.etiqueta}: ${formateaPesos(d.costo)} · ${d.ordenes} ${
                    d.ordenes === 1 ? "orden" : "órdenes"
                  }`}
                />
              </div>

              <p className="mt-1 text-xs text-gris-500">
                {d.ordenes} {d.ordenes === 1 ? "orden" : "órdenes"}
              </p>
            </li>
          );
        })}
      </ul>

      {/*
        Si se corta la lista se dice, con el numero. Un top que no declara lo que
        dejo fuera se lee como "esto es todo".
      */}
      {ocultos > 0 ? (
        <p className="mt-3 text-xs text-gris-500">
          Se muestran los {limite} de mayor costo. Quedan {ocultos} más fuera del gráfico; están
          en la tabla y en el CSV.
        </p>
      ) : null}
    </div>
  );
}
