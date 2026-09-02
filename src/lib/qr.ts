import { headers } from "next/headers";
import QRCode from "qrcode";

/*
  Generacion de codigos QR, del lado del servidor.

  El QR codifica ${base}/a/${qr_token}. El token es un UUID v4 opaco: no lleva
  el id de base de datos ni la patente, asi que una etiqueta fotografiada no
  revela nada del inventario mas alla de la ficha de ese activo.
*/

/*
  Nivel de correccion de errores Q, que recupera hasta un 25% del codigo dañado.
  El default de la libreria es M, un 15%.

  Por que se sube: estas etiquetas van pegadas a maquinaria agricola. Van a
  tener barro, rayones de rama, sol directo por temporadas y roce con
  herramientas. Un QR que deja de leerse obliga a ir a la oficina, reimprimir y
  volver al galpon. El costo de Q es un codigo un poco mas denso, irrelevante
  para una URL de unos 60 caracteres.
*/
export async function svgQr(texto: string, ancho = 256): Promise<string> {
  return QRCode.toString(texto, {
    type: "svg",
    errorCorrectionLevel: "Q",
    margin: 1,
    width: ancho,
  });
}

export type BaseQr = {
  base: string;
  /** De donde salio la base, para poder mostrarlo antes de imprimir. */
  origen: "variable de entorno" | "dominio de esta visita";
};

/*
  Base de la URL que va dentro del QR.

  Prefiere NEXT_PUBLIC_APP_URL, y si no esta cargada usa el dominio por el que
  llego la visita. Esa segunda opcion tiene una trampa: si alguien imprime
  estando en un deployment de preview, las etiquetas quedan apuntando a la URL
  del preview, que muere cuando ese deployment se borra.

  Por eso la vista de impresion muestra la base en pantalla, grande y antes de
  imprimir. La proteccion contra imprimir 80 etiquetas contra el dominio
  equivocado no es una variable de entorno bien configurada, es que la persona
  lea la URL que va a quedar impresa.
*/
export async function baseParaQr(): Promise<BaseQr> {
  const configurada = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configurada) {
    return { base: configurada.replace(/\/+$/, ""), origen: "variable de entorno" };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return { base: `${protocolo}://${host}`, origen: "dominio de esta visita" };
}

export function urlFicha(base: string, token: string): string {
  return `${base}/a/${token}`;
}
