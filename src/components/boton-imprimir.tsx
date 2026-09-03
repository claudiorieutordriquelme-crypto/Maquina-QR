"use client";

/*
  Boton de impresion. Client Component minimo porque window.print() solo existe
  en el navegador. No lleva estado ni efectos: es un onClick y nada mas.

  print:hidden lo saca de la hoja impresa. Un boton "Imprimir" impreso dentro de
  la etiqueta seria un chiste involuntario.

  El icono va siempre acompanado del texto, nunca solo. Una impresora dibujada
  sin etiqueta obliga a adivinar, y a esta pantalla entra gente que imprime un
  adhesivo una vez al mes.
*/
export function BotonImprimir({
  etiqueta = "Imprimir",
  className,
}: {
  etiqueta?: string;
  /** Deja que cada pantalla decida la jerarquia visual del boton. */
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-lg bg-primario px-5 py-3 text-sm font-semibold text-blanco shadow-tarjeta transition-all hover:opacity-90 hover:shadow-elevada print:hidden"
      }
    >
      <svg viewBox="0 0 20 20" className="size-4 shrink-0 fill-current" aria-hidden="true">
        <path d="M6 2h8v3.5H6z" />
        <path d="M4 6.5h12A2 2 0 0 1 18 8.5V14h-3.5v-2.5h-9V14H2V8.5a2 2 0 0 1 2-2zm11.2 2a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z" />
        <path d="M6.5 12.5h7V18h-7z" />
      </svg>
      {etiqueta}
    </button>
  );
}
