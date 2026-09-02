import type { Semaforo } from "@/lib/tipos";

/*
  Glifo del semaforo, compartido por todas las pantallas.

  Vive en un componente propio y no dentro de la ficha publica porque la regla
  es transversal: el estado nunca se comunica solo por color. Cuando el
  dashboard dibujaba sus tarjetas sin glifo, "Vencida" y "Critica" quedaban
  indistinguibles de un vistazo, porque comparten el mismo acento y solo se
  diferenciaban por la palabra. Con daltonismo o con una pantalla quemada por el
  sol, eso es una tarjeta que no dice nada.

  Cada estado tiene una forma distinta, no una variante de color del mismo
  icono. fill es currentColor para heredar el color del contenedor.
*/
export function GlifoSemaforo({
  estado,
  className = "size-4 shrink-0",
}: {
  estado: Semaforo;
  className?: string;
}) {
  const comun = {
    viewBox: "0 0 16 16",
    className,
    "aria-hidden": true as const,
    fill: "currentColor",
  };

  switch (estado) {
    case "vencida":
      // Circulo lleno: la forma mas pesada de la escala.
      return (
        <svg {...comun}>
          <circle cx="8" cy="8" r="7" />
          <rect x="7" y="4" width="2" height="5" rx="1" fill="var(--color-blanco)" />
          <rect x="7" y="10.5" width="2" height="2" rx="1" fill="var(--color-blanco)" />
        </svg>
      );
    case "critica":
      // Triangulo: distinto contorno, misma familia de urgencia.
      return (
        <svg {...comun}>
          <path d="M8 1.2 15.2 14H0.8L8 1.2Z" />
          <rect x="7" y="5.5" width="2" height="4.5" rx="1" fill="var(--color-blanco)" />
          <rect x="7" y="11" width="2" height="1.8" rx="0.9" fill="var(--color-blanco)" />
        </svg>
      );
    case "proxima":
      // Reloj: la unica forma con manecillas, se distingue en miniatura.
      return (
        <svg {...comun}>
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 8 3Z" />
          <path d="M7.25 4.5h1.5v4H7.25V4.5Zm0 2.75h4v1.5h-4v-1.5Z" />
        </svg>
      );
    case "al_dia":
      // Ticket: forma abierta, sin contorno cerrado, opuesta a las de alerta.
      return (
        <svg {...comun}>
          <path d="M6.2 12.6 1.8 8.2l1.6-1.6 2.8 2.8 6.4-6.4 1.6 1.6-8 8Z" />
        </svg>
      );
    default:
      // Guion en marco punteado: dice "no hay dato", no "esta bien".
      return (
        <svg {...comun}>
          <path d="M2 2h4v1.6H3.6V6H2V2Zm8 0h4v4h-1.6V3.6H10V2ZM2 10h1.6v2.4H6V14H2v-4Zm10.4 0H14v4h-4v-1.6h2.4V10Z" />
          <rect x="4.5" y="7.2" width="7" height="1.6" rx="0.8" />
        </svg>
      );
  }
}
