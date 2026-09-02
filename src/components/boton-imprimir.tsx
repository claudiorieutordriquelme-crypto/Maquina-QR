"use client";

/*
  Boton de impresion. Client Component minimo porque window.print() solo existe
  en el navegador. No lleva estado ni efectos: es un onClick y nada mas.

  print:hidden lo saca de la hoja impresa. Un boton "Imprimir" impreso dentro de
  la etiqueta seria un chiste involuntario.
*/
export function BotonImprimir({ etiqueta = "Imprimir" }: { etiqueta?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90 print:hidden"
    >
      {etiqueta}
    </button>
  );
}
