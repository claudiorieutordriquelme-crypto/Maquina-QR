import { formateaPesos } from "@/lib/formato";
import type { PuntoMes } from "@/lib/serie-mensual";

/*
  Gasto mensual y gasto acumulado de una maquina.

  DOS PANELES Y NO UN GRAFICO CON DOS EJES. Es la decision central de este
  componente. El gasto de un mes y el acumulado historico estan en la misma
  moneda pero en escalas muy distintas: al mes veinticuatro el acumulado puede
  ser treinta veces el gasto mensual. Meterlos en el mismo plano obliga a un
  segundo eje vertical, y ahi el cruce entre las dos series lo decide la escala
  que uno eligio, no el dato. Es el error de grafico mas comun que existe.

  Separados, comparten el mismo eje de meses y se leen uno debajo del otro:
  cada uno con su propia escala, sin sugerir cruces que no significan nada.

  Los dos paneles usan la misma tinta. No son dos series distintas, son la misma
  plata mirada de dos maneras.
*/

/*
  Cuantas columnas se rotulan.

  El intento anterior era ocultar una de cada dos bajo 640 px con clases de
  Tailwind, y no alcanzaba: con 24 meses quedaban 12 rotulos en 360 px de ancho,
  o sea 30 px por rotulo para un texto como "nov 25" que necesita unos 34. Los
  rotulos se salian de su columna y terminaban dibujados sobre la barra vecina,
  asi que cada uno quedaba apuntando al mes equivocado. Peor que no rotular.

  Ahora el calculo NO depende del ancho de pantalla, y por eso funciona en
  cualquiera: se rotula una de cada N columnas, con N elegido para que nunca
  haya mas de seis rotulos. Siempre entra la primera y siempre entra la ultima,
  que son las que ubican la serie en el tiempo. El resto de los valores se lee
  en la tabla de abajo, que existe justamente para eso.
*/
const MAXIMO_ROTULOS = 6;

function rotula(indice: number, total: number): boolean {
  if (total <= MAXIMO_ROTULOS) return true;
  if (indice === 0 || indice === total - 1) return true;
  const salto = Math.ceil(total / (MAXIMO_ROTULOS - 1));
  return indice % salto === 0;
}

function Columnas({
  puntos,
  valorDe,
  titulo,
  nota,
}: {
  puntos: PuntoMes[];
  valorDe: (p: PuntoMes) => number;
  titulo: string;
  nota: string;
}) {
  const maximo = Math.max(...puntos.map(valorDe), 1);

  return (
    <div>
      <p className="text-sm font-semibold text-gris-800">{titulo}</p>
      <p className="mt-0.5 text-xs text-gris-500">{nota}</p>

      <div className="mt-3 flex items-end gap-[3px] sm:gap-1" style={{ height: 96 }}>
        {puntos.map((p) => {
          const valor = valorDe(p);
          /*
            Un mes en cero se dibuja como una linea de 2 px sobre la base y no
            como nada. Sin ella, el mes desaparece del grafico y la serie parece
            tener menos meses de los que tiene.
          */
          const alto = valor === 0 ? 2 : Math.max((valor / maximo) * 96, 3);
          return (
            <div
              key={p.mes}
              className="flex min-w-0 flex-1 flex-col justify-end"
              title={`${p.etiqueta}: ${formateaPesos(valor)}`}
            >
              <div
                className={`w-full rounded-t ${valor === 0 ? "bg-gris-300" : "bg-primario"}`}
                style={{ height: alto }}
                role="img"
                aria-label={`${p.etiqueta}: ${formateaPesos(valor)}`}
              />
            </div>
          );
        })}
      </div>

      {/* La linea base va bajo las columnas, en gris recesivo. */}
      <div className="border-t border-gris-300" />

      {/*
        overflow-hidden en cada celda: si un rotulo no cabe se recorta en su
        propia columna en vez de invadir la vecina. whitespace-nowrap para que no
        se parta "nov 25" en dos lineas.
      */}
      <div className="mt-1 flex gap-[3px] sm:gap-1">
        {puntos.map((p, i) => (
          <span
            key={p.mes}
            className="min-w-0 flex-1 overflow-hidden text-center text-[10px] leading-tight whitespace-nowrap text-gris-500"
          >
            {rotula(i, puntos.length) ? p.etiqueta : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SerieGasto({
  puntos,
  mesesRecortados = 0,
  advertencia,
}: {
  puntos: PuntoMes[];
  /** Meses anteriores a la ventana visible. Un recorte que no se declara se
      lee como "esto es todo el historial". */
  mesesRecortados?: number;
  /** Aviso sobre el origen de los datos. La ficha publica lo usa para decir que
      calcula sobre un historial acotado y no sobre la vida completa. */
  advertencia?: string;
}) {
  if (puntos.length === 0) {
    return (
      <p className="rounded-lg border border-gris-200 p-4 text-sm text-gris-600">
        Esta máquina todavía no tiene mantenciones completadas, así que no hay
        gasto que graficar.
      </p>
    );
  }

  if (puntos.length === 1) {
    /*
      Un solo mes no es una serie de tiempo. Dibujar una columna sola invita a
      leer una tendencia donde hay un punto, asi que se muestra el numero.
    */
    const p = puntos[0];
    return (
      <div className="rounded-lg border border-gris-200 p-4">
        <p className="text-sm text-gris-600">Un solo mes con gasto registrado.</p>
        <p className="mt-1 text-lg font-bold text-gris-900">
          {p.etiqueta}: {formateaPesos(p.monto)}
        </p>
      </div>
    );
  }

  const mayor = puntos.reduce((a, b) => (b.monto > a.monto ? b : a));
  const ultimo = puntos[puntos.length - 1];

  return (
    <div className="space-y-6">
      {advertencia ? <p className="text-xs text-gris-500">{advertencia}</p> : null}

      <Columnas
        puntos={puntos}
        valorDe={(p) => p.monto}
        titulo="Gasto por mes"
        nota={`Mes más caro: ${mayor.etiqueta} con ${formateaPesos(mayor.monto)}.`}
      />

      <Columnas
        puntos={puntos}
        valorDe={(p) => p.acumulado}
        titulo="Gasto acumulado"
        nota={`Al cierre de ${ultimo.etiqueta} suma ${formateaPesos(ultimo.acumulado)}.`}
      />

      {mesesRecortados > 0 ? (
        <p className="text-xs text-gris-500">
          Se muestran los últimos {puntos.length} meses. Quedan {mesesRecortados} más
          atrás, ya sumados en el acumulado.
        </p>
      ) : null}

      {/*
        La vista de tabla no es un extra. Es lo que permite leer cualquier mes
        exacto sin depender de comparar alturas ni de pasar el cursor por
        encima, que en un telefono no existe.
      */}
      <details className="rounded-lg border border-gris-200">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-gris-800 marker:text-primario">
          Ver los montos mes a mes
        </summary>
        <div className="max-h-56 overflow-y-auto border-t border-gris-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-blanco">
              <tr className="border-b border-gris-200 text-left text-xs font-semibold tracking-wide text-gris-500 uppercase">
                <th className="px-3 py-2">Mes</th>
                <th className="px-3 py-2 text-right">Gasto</th>
                <th className="px-3 py-2 text-right">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {puntos.map((p) => (
                <tr key={p.mes} className="border-b border-gris-100 last:border-0">
                  <td className="px-3 py-1.5 text-gris-700">{p.etiqueta}</td>
                  <td className="px-3 py-1.5 text-right font-medium text-gris-900">
                    {formateaPesos(p.monto)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-gris-700">
                    {formateaPesos(p.acumulado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
