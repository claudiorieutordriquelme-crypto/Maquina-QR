"use client";

import { useCallback, useEffect, useId, useRef } from "react";

/*
  Dialogo modal con el comportamiento de teclado y de foco que hay que tener.

  Existe porque habia dos modales en la aplicacion, la previsualizacion del ojo
  y la confirmacion de borrado, y los dos repetian el mismo esqueleto con los
  mismos cinco defectos. Una auditoria los encontro uno por uno. Estan
  arreglados aca, una vez:

  1. TRAMPA DE FOCO. Con Tab se salia del dialogo hacia la pagina de atras, que
     esta tapada por el velo. El foco quedaba en enlaces invisibles y un Enter
     ahi abria un segundo dialogo encima del primero.
  2. DEVOLVER EL FOCO. Al cerrar, el foco se perdia en el body, asi que el
     siguiente Tab arrancaba desde el encabezado de la pagina. Quien navega con
     teclado o con lector de pantalla tenia que recorrer todo de nuevo para
     volver donde estaba. Ahora vuelve al elemento que lo abrio.
  3. BLOQUEO DE SCROLL. El fondo seguia desplazandose detras del velo. En un
     telefono, donde el modal es hoja inferior y el velo ocupa la mitad de
     arriba, arrastrar ahi movia el listado de atras en vez de la ficha.
  4. ESCAPE QUE SE PROPAGA. El tutorial escucha Escape en window para salir del
     recorrido. Un solo Escape cerraba el modal Y abandonaba el tutorial, justo
     en el paso que invita a abrir ese modal. Aca se detiene la propagacion.
  5. EL FOCO INICIAL. Se enfocaba el contenedor y eso pisaba el autoFocus del
     campo de confirmacion: se podia escribir el codigo y no entraba ninguna
     tecla. Ahora se busca el primer campo enfocable y, si no hay, el contenedor.

  El elemento <dialog> nativo resolveria varias de estas, pero no todas de la
  misma manera en los navegadores que se usan en terreno, y su modo modal cambia
  el apilamiento de la hoja inferior. Se hace a mano y queda explicito.
*/

const ENFOCABLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Dialogo({
  titulo,
  alCerrar,
  children,
  ancho = "max-w-2xl",
}: {
  /** Se usa como aria-label del dialogo. El contenido decide como pintarlo. */
  titulo: string;
  alCerrar: () => void;
  children: React.ReactNode;
  ancho?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const idTitulo = useId();

  /** Quien tenia el foco antes de abrir, para devolverselo al cerrar. */
  const origen = useRef<HTMLElement | null>(null);

  const cerrar = useCallback(() => {
    alCerrar();
  }, [alCerrar]);

  /*
    EL ORDEN DE ESTOS DOS EFECTOS IMPORTA. React los ejecuta en el orden en que
    estan escritos, asi que el primero alcanza a anotar quien tenia el foco
    antes de que el segundo lo mueva al dialogo. Al reves, el origen quedaria
    apuntando al propio dialogo y el foco nunca volveria.
  */
  useEffect(() => {
    origen.current = document.activeElement as HTMLElement | null;
  }, []);

  /* Foco inicial: el primer campo, y el contenedor solo si no hay ninguno. */
  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const primero = nodo.querySelector<HTMLElement>(ENFOCABLES);
    (primero ?? nodo).focus();
  }, []);

  /*
    Devolver el foco al cerrar. Se comprueba que el elemento siga en el
    documento: el boton que abrio el dialogo puede haber desaparecido, por
    ejemplo si la fila que lo contenia se borro.
  */
  useEffect(() => {
    return () => {
      const previo = origen.current;
      if (previo && document.contains(previo)) previo.focus();
    };
  }, []);

  /* Bloqueo del scroll del documento mientras el dialogo esta abierto. */
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  /*
    Escape y Tab. El manejador va en el nodo del dialogo y no en window, y
    detiene la propagacion: asi el Escape que cierra este dialogo no llega
    tambien al manejador del tutorial, que lo interpretaba como abandonar el
    recorrido.
  */
  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;

    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cerrar();
        return;
      }

      if (e.key !== "Tab") return;

      const campos = [...nodo.querySelectorAll<HTMLElement>(ENFOCABLES)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (campos.length === 0) {
        e.preventDefault();
        nodo.focus();
        return;
      }

      const primero = campos[0];
      const ultimo = campos[campos.length - 1];
      const activo = document.activeElement;

      /* El ciclo se cierra en los dos sentidos, incluido el caso en que el foco
         esta en el contenedor y no en un campo. */
      if (e.shiftKey && (activo === primero || activo === nodo)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    nodo.addEventListener("keydown", alPulsar);
    return () => nodo.removeEventListener("keydown", alPulsar);
  }, [cerrar]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 print:hidden">
      {/* El velo tambien contiene el gesto de arrastre, para que en un telefono
          desplazar sobre el velo no mueva la pagina de atras. */}
      <div
        aria-hidden="true"
        onClick={cerrar}
        className="absolute inset-0 overscroll-contain bg-negro/55"
        onTouchMove={(e) => e.preventDefault()}
      />

      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={`relative max-h-[92dvh] w-full ${ancho} overflow-y-auto overscroll-contain rounded-t-xl border border-gris-200 bg-blanco shadow-elevada outline-none sm:rounded-xl`}
      >
        {/* Titulo accesible siempre presente, aunque el contenido pinte el suyo. */}
        <span id={idTitulo} className="sr-only">
          {titulo}
        </span>
        {children}
      </div>
    </div>
  );
}
