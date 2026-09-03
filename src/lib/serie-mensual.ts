/*
  Aritmetica de la serie mensual de gasto.

  Vive aparte y sin ninguna importacion a proposito. La usan tres lugares con
  origenes de datos distintos: el resumen del panel, la ficha privada de cada
  activo y la ficha publica que abre el QR. Esa ultima es un Server Component
  sin una linea de JavaScript de cliente, y arrastrar hasta ahi el modulo de
  consultas, que importa el cliente de Supabase, seria pagar por algo que esa
  pantalla no usa.

  Que este archivo no tenga dependencias tambien lo hace probable en aislamiento,
  que es lo que corresponde a la unica parte del sistema que hace cuentas.
*/

export type PuntoMes = {
  /** Clave ordenable, formato AAAA-MM. */
  mes: string;
  /** Como se escribe en pantalla: "ene 26". */
  etiqueta: string;
  monto: number;
  acumulado: number;
};

const MES_CORTO = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/*
  La etiqueta se arma con los componentes de la cadena y NO con new Date(iso).
  Una fecha sin hora se interpreta como UTC, y en Chile eso corre el dia hacia
  atras: una orden del 1 de marzo aparecería en febrero.
*/
export function etiquetaMes(mes: string): string {
  const [anio, m] = mes.split("-");
  const indice = Number(m) - 1;
  if (!anio || Number.isNaN(indice) || indice < 0 || indice > 11) return mes;
  return `${MES_CORTO[indice]} ${anio.slice(2)}`;
}

/** Suma un mes a una clave AAAA-MM sin pasar por Date. */
export function mesSiguiente(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return m === 12 ? `${anio + 1}-01` : `${anio}-${String(m + 1).padStart(2, "0")}`;
}

/** Mes de una fecha ISO, por corte de cadena y no por Date. Ver etiquetaMes. */
export function mesDeFecha(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return null;
  const numero = Number(m[2]);
  if (numero < 1 || numero > 12) return null;
  return `${m[1]}-${m[2]}`;
}

/*
  Tope de columnas que armaSerieMensual esta dispuesta a generar antes de
  rendirse. No es una preferencia de diseno: es un cinturon de seguridad contra
  una fecha corrupta que haga que el bucle de relleno no termine nunca. Cincuenta
  anos de historial mensual.
*/
const MAXIMO_MESES = 600;

export type SerieMensual = {
  puntos: PuntoMes[];
  /** Meses que quedaron fuera por el recorte de ventana. */
  recortados: number;
  /**
   * true si el relleno se corto por el cinturon de seguridad. Cuando pasa, la
   * serie NO es confiable y quien la muestre tiene que decirlo en vez de
   * dibujar un grafico incompleto como si fuera completo.
   */
  truncadaPorSeguridad: boolean;
};

/*
  Serie mensual con los huecos rellenos.

  Un mes sin gasto tiene que aparecer con cero y no desaparecer del eje. Si se
  omitiera, dos meses separados por un ano de inactividad quedarian pegados y el
  grafico contaria una historia falsa sobre el ritmo del gasto.

  El acumulado se calcula ANTES de recortar la ventana visible: si se calculara
  despues, el acumulado del primer mes visible partiria en cero y diria que la
  maquina no habia gastado nada antes, que es falso.
*/
export function armaSerieMensual(
  movimientos: { mes: string; monto: number }[],
  tope: number,
): SerieMensual {
  const vacia: SerieMensual = { puntos: [], recortados: 0, truncadaPorSeguridad: false };
  if (movimientos.length === 0) return vacia;

  const porMes = new Map<string, number>();
  for (const m of movimientos) {
    if (!/^\d{4}-\d{2}$/.test(m.mes)) continue;
    porMes.set(m.mes, (porMes.get(m.mes) ?? 0) + m.monto);
  }
  if (porMes.size === 0) return vacia;

  const claves = [...porMes.keys()].sort();
  const primero = claves[0];
  const ultimo = claves[claves.length - 1];

  const completos: string[] = [];
  let truncadaPorSeguridad = false;
  for (let cursor = primero; ; cursor = mesSiguiente(cursor)) {
    completos.push(cursor);
    if (cursor === ultimo) break;
    if (completos.length >= MAXIMO_MESES) {
      truncadaPorSeguridad = true;
      break;
    }
  }

  let acumulado = 0;
  const serie = completos.map((mes) => {
    acumulado += porMes.get(mes) ?? 0;
    return { mes, etiqueta: etiquetaMes(mes), monto: porMes.get(mes) ?? 0, acumulado };
  });

  const puntos = tope > 0 && serie.length > tope ? serie.slice(-tope) : serie;

  return {
    puntos,
    recortados: serie.length - puntos.length,
    truncadaPorSeguridad,
  };
}
