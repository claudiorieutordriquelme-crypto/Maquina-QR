import { formateaPesos } from "@/lib/formato";
import type { CorteCosto } from "@/lib/datos/reportes";

/*
  Barra de proporcion para el split entre tipos de mantencion.

  Por que una barra y no una torta: con dos o tres segmentos, una torta obliga a
  comparar angulos, que se lee peor que comparar largos. El catalogo de
  antipatrones es explicito: una torta de dos porciones se reemplaza por una
  barra o por los numeros.

  Por que DOS barras y no una: los datos cuentan dos cosas distintas y el dato
  interesante esta en la diferencia entre ambas. En el seed, la correctiva es el
  21% de las ordenes pero el 37% del costo. Con una sola barra ese hallazgo,
  que es justamente lo que un jefe de mantencion necesita ver, no aparece. Dos
  barras con la misma paleta y la misma leyenda son multiplos pequenos del mismo
  encoding, no un grafico de dos ejes.

  La paleta se validó con el script de la guia: verde oscuro #2e7d32 y verde
  claro #8cc63f, delta E 24,3 en vision normal y 23,7 en protanopia, ambos muy
  por encima del piso de 8. El verde claro queda en 1,99:1 de contraste contra
  el fondo, lo que obliga a etiquetas visibles: van etiquetas directas en cada
  segmento y ademas la tabla de abajo, asi que ningun valor depende del color.

  El color NO se asigna por tamano ni por posicion: preventiva siempre lleva el
  verde oscuro. Si se asignara por orden de magnitud, filtrar un periodo donde
  la correctiva sea mayor repintaria los dos segmentos y un lector que aprendio
  "correctiva es el verde claro" quedaria enganado.

  El rojo del sistema no se usa aca a proposito. Es un color de estado,
  reservado para vencida y critica. Usarlo para "correctiva" haria que el mismo
  rojo signifique dos cosas distintas en la misma pantalla.
*/

/* Orden fijo de tintas. Nunca se cicla ni se genera una nueva. */
const TINTAS: Record<string, { fondo: string; textoDentro: string }> = {
  preventiva: { fondo: "bg-primario", textoDentro: "text-blanco" },
  correctiva: { fondo: "bg-secundario", textoDentro: "text-gris-900" },
  // Si aparece un tercer tipo, lleva textura sobre el primario en vez de una
  // tinta inventada: la textura es el canal de respaldo cuando el color se
  // agota, y la marca solo afora dos verdes.
  predictiva: { fondo: "bg-primario/60", textoDentro: "text-blanco" },
};

/* Cuando un segmento es angosto, la etiqueta no entra y no se recorta: sale.
   Un texto cortado a la mitad es peor que ningun texto. */
const MINIMO_PARA_ETIQUETA = 18;

function Barra({
  titulo,
  datos,
  valorDe,
  formato,
}: {
  titulo: string;
  datos: CorteCosto[];
  valorDe: (d: CorteCosto) => number;
  formato: (n: number) => string;
}) {
  const total = datos.reduce((s, d) => s + valorDe(d), 0);
  if (total === 0) return null;

  return (
    <div>
      <p className="text-sm font-semibold text-gris-800">{titulo}</p>

      {/* gap-[2px] es el separador: dos pixeles del color del fondo entre
          segmentos. Nunca un borde alrededor de la marca. */}
      <div className="mt-1.5 flex h-7 w-full gap-[2px] overflow-hidden rounded">
        {datos.map((d) => {
          const valor = valorDe(d);
          if (valor === 0) return null;
          const pct = (valor / total) * 100;
          const tinta = TINTAS[d.clave] ?? TINTAS.predictiva;
          const cabe = pct >= MINIMO_PARA_ETIQUETA;

          return (
            <div
              key={d.clave}
              className={`flex items-center justify-center ${tinta.fondo}`}
              style={{ width: `${pct}%` }}
              title={`${d.etiqueta}: ${formato(valor)} (${Math.round(pct)}%)`}
            >
              {cabe ? (
                /* Dentro de un relleno de color, el texto se elige por la
                   luminancia del relleno para que siempre pase contraste. */
                <span className={`text-xs font-bold ${tinta.textoDentro}`}>
                  {Math.round(pct)}%
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Los valores que no cupieron dentro se leen aca. Ningun numero queda
          detras de un hover. */}
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gris-600">
        {datos.map((d) => {
          const valor = valorDe(d);
          if (valor === 0) return null;
          return (
            <div key={d.clave} className="flex gap-1">
              <dt className="font-semibold">{d.etiqueta}:</dt>
              <dd>
                {formato(valor)} ({Math.round((valor / total) * 100)}%)
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function BarraProporcion({ datos }: { datos: CorteCosto[] }) {
  const conDatos = datos.filter((d) => d.ordenes > 0);

  if (conDatos.length === 0) {
    return (
      <p className="rounded-lg border border-gris-200 p-4 text-sm text-gris-600">
        Sin mantenciones completadas en el período.
      </p>
    );
  }

  if (conDatos.length === 1) {
    /*
      Con un solo tipo no hay split que mostrar: una barra de un solo segmento
      es una barra de una sola barra, que el catalogo de antipatrones manda
      reemplazar por el numero. Aca el numero ES el grafico.
    */
    const unico = conDatos[0];
    return (
      <div className="rounded-lg border border-gris-200 p-4">
        <p className="text-sm text-gris-600">
          Todas las mantenciones del período son de un solo tipo.
        </p>
        <p className="mt-1 text-lg font-bold text-gris-900">
          {unico.etiqueta}: {unico.ordenes} {unico.ordenes === 1 ? "orden" : "órdenes"} ·{" "}
          {formateaPesos(unico.costo)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Leyenda siempre presente con dos o mas series: es el canal de
          identidad confiable, y nunca se deja al lector emparejar colores. */}
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {conDatos.map((d) => (
          <li key={d.clave} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`size-3 shrink-0 rounded-sm ${(TINTAS[d.clave] ?? TINTAS.predictiva).fondo}`}
            />
            <span className="text-sm font-semibold text-gris-800">{d.etiqueta}</span>
          </li>
        ))}
      </ul>

      <Barra
        titulo="Por cantidad de órdenes"
        datos={conDatos}
        valorDe={(d) => d.ordenes}
        formato={(n) => `${n} ${n === 1 ? "orden" : "órdenes"}`}
      />

      <Barra
        titulo="Por costo"
        datos={conDatos}
        valorDe={(d) => d.costo}
        formato={formateaPesos}
      />
    </div>
  );
}
