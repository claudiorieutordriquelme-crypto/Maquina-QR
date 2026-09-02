import { svgQr, urlFicha } from "@/lib/qr";

/*
  Etiqueta adhesiva de un activo.

  Medidas en milimetros y no en pixeles, porque esto se imprime: 70 por 50 mm,
  que es un formato de etiqueta adhesiva corriente y entra seis veces en una
  hoja carta. En pantalla los milimetros se ven igual de bien, asi que la vista
  previa muestra exactamente lo que va a salir de la impresora.

  El SVG se inyecta con dangerouslySetInnerHTML y eso esta bien acotado: lo
  genera la libreria qrcode en el servidor a partir de una URL que armamos
  nosotros, no hay entrada de usuario en el medio.
*/
export async function EtiquetaQr({
  base,
  nombre,
  codigoInterno,
  token,
}: {
  base: string;
  nombre: string;
  codigoInterno: string;
  token: string;
}) {
  const svg = await svgQr(urlFicha(base, token), 512);

  return (
    <div
      className="flex items-center gap-[3mm] break-inside-avoid rounded-sm border border-gris-300 bg-blanco p-[3mm]"
      style={{ width: "70mm", height: "50mm" }}
    >
      <div
        className="shrink-0 [&>svg]:h-full [&>svg]:w-full"
        style={{ width: "40mm", height: "40mm" }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch py-[1mm]">
        <div className="min-w-0">
          {/* El codigo de flota va primero y grande: en terreno se busca por
              codigo, no por nombre comercial. */}
          <p className="text-[5mm] leading-none font-bold text-negro">{codigoInterno}</p>
          <p className="mt-[1.5mm] text-[3mm] leading-tight font-semibold break-words text-gris-800">
            {nombre}
          </p>
        </div>

        <p className="text-[2.2mm] leading-tight text-gris-600">
          Escanea con la cámara para ver el historial de mantención
        </p>
      </div>
    </div>
  );
}
