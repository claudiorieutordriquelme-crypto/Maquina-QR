"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PASOS_TUTORIAL } from "@/lib/tutorial/pasos";

/*
  Recorrido guiado dentro de la aplicacion.

  La diferencia con un manual no es el tono, es el anclaje: cada paso destaca un
  elemento real de la pantalla y navega solo hasta la seccion donde ese elemento
  vive. El texto no describe la interfaz, la senala.

  Decisiones que vale conocer antes de tocar esto:

  - El foco se hace con cuatro rectangulos que rodean al elemento, no con una
    mascara SVG ni con un recorte. Es mas simple de calcular, funciona igual en
    cualquier navegador, y deja el elemento destacado completamente interactivo:
    quien esta aprendiendo puede apretarlo de verdad en vez de mirarlo.
  - Si un ancla no aparece, el paso NO se rompe: cae a una tarjeta centrada con
    el mismo texto. Un recorrido a medias es mejor que un recorrido trabado.
  - El estado se guarda en el navegador de cada persona, envuelto en try/catch:
    en una ventana privada o con las cookies bloqueadas, localStorage lanza. Un
    tutorial que revienta la pagina por no poder recordar el paso 3 seria peor
    que no tener tutorial.
  - Arranca solo una vez, la primera vez que alguien entra al resumen. Despues
    queda a mano en el boton del encabezado. Un tutorial que se abre siempre
    deja de ser ayuda y pasa a ser un obstaculo.
*/

const CLAVE = "maquina-qr:tutorial:v1";
const MARGEN_FOCO = 8;
const ANCHO_TARJETA = 380;
const INTENTOS_ANCLA = 40;
const ESPERA_ANCLA = 50;

type Recuadro = { top: number; left: number; width: number; height: number };

function leerEstado(): { completado: boolean } {
  try {
    const bruto = window.localStorage.getItem(CLAVE);
    return bruto ? (JSON.parse(bruto) as { completado: boolean }) : { completado: false };
  } catch {
    // Ventana privada, cookies bloqueadas, o almacenamiento lleno. Se asume no
    // completado: como maximo el tutorial se ofrece de nuevo.
    return { completado: false };
  }
}

function guardarCompletado() {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify({ completado: true }));
  } catch {
    // Sin persistencia el recorrido igual funciona, solo se vuelve a ofrecer.
  }
}

export function Tutorial() {
  const router = useRouter();
  const ruta = usePathname();

  const [activo, setActivo] = useState(false);
  const [indice, setIndice] = useState(0);
  /*
    El recuadro se guarda junto al id del paso al que pertenece, y no suelto.

    Eso resuelve dos cosas de una. Primero, no hace falta limpiarlo al cambiar
    de paso, que era un setState sincronico dentro de un efecto. Y segundo, y
    mas importante, arregla un parpadeo real: al avanzar de un elemento a otro,
    el foco se quedaba un instante sobre el elemento anterior, porque el
    recuadro viejo seguia en estado hasta que el nuevo terminaba de medirse.
    Ahora un recuadro que no corresponde al paso actual simplemente no se usa.
  */
  const [medido, setMedido] = useState<{ id: string; recuadro: Recuadro } | null>(null);
  const [angosto, setAngosto] = useState(false);

  const tarjetaRef = useRef<HTMLDivElement>(null);
  const paso = PASOS_TUTORIAL[indice];
  const ultimo = indice === PASOS_TUTORIAL.length - 1;

  // Derivado, no almacenado: si la medicion es de otro paso, no vale.
  const recuadro = medido && paso && medido.id === paso.id ? medido.recuadro : null;

  /* Se consulta una vez y se guarda: usarlo en el render directo obligaria a
     leer el ancho en cada medicion. */
  useEffect(() => {
    const medir = () => setAngosto(window.innerWidth < 640);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const cerrar = useCallback((completado: boolean) => {
    setActivo(false);
    setMedido(null);
    if (completado) guardarCompletado();
  }, []);

  const abrir = useCallback(() => {
    setIndice(0);
    setActivo(true);
  }, []);

  /*
    Arranque automatico, solo la primera vez y solo en el resumen. Se espera un
    momento para que la pagina haya pintado: abrirlo sobre una pantalla a medio
    renderizar mide un elemento que todavia se esta moviendo.
  */
  useEffect(() => {
    if (ruta !== "/admin") return;
    if (leerEstado().completado) return;
    const t = setTimeout(() => setActivo(true), 700);
    return () => clearTimeout(t);
  }, [ruta]);

  /*
    Navegacion entre secciones. El recorrido cruza rutas, asi que cuando el paso
    vive en otra pantalla se empuja la ruta y el anclaje reintenta hasta que el
    elemento aparece.
  */
  useEffect(() => {
    if (!activo || !paso) return;
    if (paso.ruta !== ruta) router.push(paso.ruta as "/admin");
  }, [activo, paso, ruta, router]);

  /* Anclaje: busca el elemento, lo trae a la vista y mide su recuadro. */
  useEffect(() => {
    if (!activo || !paso) return;

    // Sin ancla el paso va centrado, y el recuadro derivado ya da null: no hay
    // nada que limpiar ni que medir.
    if (!paso.ancla) return;
    if (paso.ruta !== ruta) return;

    const idPaso = paso.id;
    let cancelado = false;
    let intentos = 0;

    const medir = (el: Element) => {
      const r = el.getBoundingClientRect();
      setMedido({
        id: idPaso,
        recuadro: { top: r.top, left: r.left, width: r.width, height: r.height },
      });
    };

    const buscar = () => {
      if (cancelado) return;
      const el = document.querySelector(`[data-tour="${paso.ancla}"]`);

      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        medir(el);
        // Se vuelve a medir cuando el scroll suave termino de moverse.
        setTimeout(() => !cancelado && medir(el), 350);
        return;
      }

      intentos += 1;
      // Si se agotan los intentos no se hace nada: al no haber medicion para
      // este paso, el recuadro derivado queda null y la tarjeta va centrada con
      // el mismo texto. Un recorrido a medias es mejor que uno trabado.
      if (intentos < INTENTOS_ANCLA) setTimeout(buscar, ESPERA_ANCLA);
    };

    buscar();
    return () => {
      cancelado = true;
    };
  }, [activo, paso, ruta]);

  /* El recuadro sigue al elemento si la pagina se mueve o cambia de tamano. */
  useEffect(() => {
    if (!activo || !paso?.ancla) return;

    const idPaso = paso.id;
    const recalcular = () => {
      const el = document.querySelector(`[data-tour="${paso.ancla}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMedido({
        id: idPaso,
        recuadro: { top: r.top, left: r.left, width: r.width, height: r.height },
      });
    };

    window.addEventListener("scroll", recalcular, { passive: true });
    window.addEventListener("resize", recalcular);
    return () => {
      window.removeEventListener("scroll", recalcular);
      window.removeEventListener("resize", recalcular);
    };
  }, [activo, paso]);

  const siguiente = useCallback(() => {
    if (ultimo) {
      cerrar(true);
      return;
    }
    setIndice((i) => i + 1);
  }, [ultimo, cerrar]);

  const anterior = useCallback(() => setIndice((i) => Math.max(0, i - 1)), []);

  /* Teclado: Escape sale, flechas y Enter avanzan. */
  useEffect(() => {
    if (!activo) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrar(false);
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        siguiente();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        anterior();
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [activo, cerrar, siguiente, anterior]);

  /* El foco viaja a la tarjeta en cada paso, para que el teclado siga el hilo. */
  useEffect(() => {
    if (activo) tarjetaRef.current?.focus();
  }, [activo, indice]);

  if (!activo || !paso) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="rounded-md border border-primario px-3 py-2 text-sm font-semibold text-primario transition-colors hover:bg-primario hover:text-blanco print:hidden"
      >
        Tutorial
      </button>
    );
  }

  /*
    Posicion de la tarjeta. Bajo 640 px se ancla al borde inferior: en un
    telefono, una tarjeta flotando junto al elemento tapa justamente lo que se
    esta explicando. En escritorio va debajo del elemento, o arriba si no cabe,
    y se recorta a la ventana para no salirse por el costado.
  */
  const estiloTarjeta: React.CSSProperties = angosto
    ? { left: 12, right: 12, bottom: 12 }
    : recuadro
      ? (() => {
          const cabeAbajo = recuadro.top + recuadro.height + 260 < window.innerHeight;
          const izquierda = Math.min(
            Math.max(12, recuadro.left + recuadro.width / 2 - ANCHO_TARJETA / 2),
            window.innerWidth - ANCHO_TARJETA - 12,
          );
          return cabeAbajo
            ? { top: recuadro.top + recuadro.height + MARGEN_FOCO + 12, left: izquierda, width: ANCHO_TARJETA }
            : { bottom: window.innerHeight - recuadro.top + MARGEN_FOCO + 12, left: izquierda, width: ANCHO_TARJETA };
        })()
      : {
          top: "50%",
          left: "50%",
          width: ANCHO_TARJETA,
          transform: "translate(-50%, -50%)",
        };

  const velo = "fixed bg-negro/55 print:hidden";

  return (
    <>
      <button
        type="button"
        onClick={() => cerrar(false)}
        className="rounded-md border border-primario px-3 py-2 text-sm font-semibold text-primario print:hidden"
      >
        Cerrar tutorial
      </button>

      {/*
        Cuatro rectangulos alrededor del elemento en vez de una mascara. El
        hueco queda completamente interactivo, asi que se puede apretar el
        elemento que se esta explicando.
      */}
      {recuadro ? (
        <div aria-hidden="true" className="fixed inset-0 z-40 print:hidden">
          <div
            className={velo}
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, recuadro.top - MARGEN_FOCO) }}
          />
          <div
            className={velo}
            style={{ top: recuadro.top + recuadro.height + MARGEN_FOCO, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className={velo}
            style={{
              top: recuadro.top - MARGEN_FOCO,
              left: 0,
              width: Math.max(0, recuadro.left - MARGEN_FOCO),
              height: recuadro.height + MARGEN_FOCO * 2,
            }}
          />
          <div
            className={velo}
            style={{
              top: recuadro.top - MARGEN_FOCO,
              left: recuadro.left + recuadro.width + MARGEN_FOCO,
              right: 0,
              height: recuadro.height + MARGEN_FOCO * 2,
            }}
          />

          {/* Anillo sobre el elemento, sin capturar clics. */}
          <div
            className="pointer-events-none fixed rounded-lg ring-2 ring-primario ring-offset-2 ring-offset-blanco"
            style={{
              top: recuadro.top - MARGEN_FOCO / 2,
              left: recuadro.left - MARGEN_FOCO / 2,
              width: recuadro.width + MARGEN_FOCO,
              height: recuadro.height + MARGEN_FOCO,
            }}
          />
        </div>
      ) : (
        <div aria-hidden="true" onClick={() => cerrar(false)} className="fixed inset-0 z-40 bg-negro/55 print:hidden" />
      )}

      <div
        ref={tarjetaRef}
        role="dialog"
        aria-labelledby="tutorial-titulo"
        aria-describedby="tutorial-texto"
        tabIndex={-1}
        className="fixed z-50 max-w-[calc(100vw-24px)] rounded-xl border border-gris-200 bg-blanco p-5 shadow-elevada outline-none print:hidden"
        style={estiloTarjeta}
      >
        {/* Lo que el lector de pantalla anuncia al cambiar de paso. */}
        <p aria-live="polite" className="sr-only">
          Paso {indice + 1} de {PASOS_TUTORIAL.length}: {paso.titulo}
        </p>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold tracking-widest text-primario uppercase">
            Paso {indice + 1} de {PASOS_TUTORIAL.length}
          </p>
          <button
            type="button"
            onClick={() => cerrar(false)}
            className="-m-1 rounded p-1 text-sm font-semibold text-gris-500 hover:text-gris-900"
          >
            Salir
          </button>
        </div>

        {/* Barra de avance: dice cuánto queda sin obligar a contar los pasos. */}
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-gris-200">
          <div
            className="h-full rounded-full bg-primario transition-[width] duration-300"
            style={{ width: `${((indice + 1) / PASOS_TUTORIAL.length) * 100}%` }}
          />
        </div>

        <h2 id="tutorial-titulo" className="mt-3 text-lg font-bold text-gris-900">
          {paso.titulo}
        </h2>
        <p id="tutorial-texto" className="mt-2 text-sm text-gris-700">
          {paso.texto}
        </p>

        {paso.ojo ? (
          <div className="mt-3 flex overflow-hidden rounded-md border border-gris-200">
            <div className="w-1.5 shrink-0 bg-acento" aria-hidden="true" />
            <p className="p-2.5 text-sm text-gris-800">{paso.ojo}</p>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={anterior}
            disabled={indice === 0}
            className="rounded-md border border-gris-300 px-3 py-2 text-sm font-semibold text-gris-800 disabled:opacity-40"
          >
            Anterior
          </button>

          <button
            type="button"
            onClick={siguiente}
            className="rounded-md bg-primario px-4 py-2 text-sm font-semibold text-blanco transition-opacity hover:opacity-90"
          >
            {ultimo ? "Terminar" : "Siguiente"}
          </button>
        </div>

        <p className="mt-3 text-xs text-gris-500">
          Puedes usar las flechas del teclado, y Escape para salir. El elemento
          destacado sigue funcionando: pruébalo si quieres.
        </p>
      </div>
    </>
  );
}
