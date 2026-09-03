"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PASOS_TUTORIAL } from "@/lib/tutorial/pasos";
import type { Rol } from "@/lib/roles";

/*
  Recorrido guiado dentro de la aplicacion.

  La diferencia con un manual no es el tono, es el anclaje: cada paso destaca un
  elemento real de la pantalla y navega solo hasta la seccion donde ese elemento
  vive. El texto no describe la interfaz, la senala.

  Decisiones que vale conocer antes de tocar esto:

  - El foco se hace con cuatro rectangulos que rodean al elemento, no con una
    mascara SVG. Es mas simple de calcular, se comporta igual en cualquier
    navegador, y deja el elemento destacado completamente interactivo: quien
    esta aprendiendo puede apretarlo de verdad en vez de mirarlo.
  - Si un ancla no aparece, el paso NO se rompe: cae a hoja inferior con el
    mismo texto. Un recorrido a medias es mejor que uno trabado.
  - El estado se guarda en el navegador, envuelto en try/catch: en ventana
    privada localStorage lanza, y un tutorial que revienta la pagina por no
    poder recordar el paso 3 seria peor que no tenerlo.
  - Arranca una sola vez. Un tutorial que se abre siempre deja de ser ayuda.

  TRES REGLAS DE COLOCACION, aprendidas de un recorte real en pantalla.

  La primera version centraba la tarjeta con translateY(-50%) y sin alto
  maximo. Con el texto de un paso mas su advertencia, la tarjeta quedaba mas
  alta que el espacio disponible y se salia por arriba: el "Paso 1 de 14", la
  barra de avance y el titulo quedaban fuera de la pantalla, sin scroll para
  alcanzarlos. Ahora:

  1. La tarjeta nunca excede el viewport. Siempre lleva alto maximo y scroll
     propio, en las tres colocaciones.
  2. Si no hay espacio suficiente junto al elemento, se ancla al borde inferior
     en vez de forzar una posicion que no cabe. El foco sobre el elemento se
     mantiene igual.
  3. Bajo 640 px es siempre hoja inferior. En un telefono, una tarjeta flotando
     junto al elemento tapa justamente lo que se esta explicando.
*/

const CLAVE = "maquina-qr:tutorial:v1";
const MARGEN_FOCO = 8;
const ANCHO_TARJETA = 380;
const ALTO_MINIMO_TARJETA = 280;
const INTENTOS_ANCLA = 40;
const ESPERA_ANCLA = 50;

type Recuadro = { top: number; left: number; width: number; height: number };
type Ventana = { ancho: number; alto: number };

/** Donde se dibuja la tarjeta. La hoja inferior es el respaldo de todo. */
type Colocacion =
  | { modo: "hoja" }
  | { modo: "centrada" }
  | { modo: "anclada"; estilo: React.CSSProperties };

function leerEstado(): { completado: boolean } {
  try {
    const bruto = window.localStorage.getItem(CLAVE);
    return bruto ? (JSON.parse(bruto) as { completado: boolean }) : { completado: false };
  } catch {
    return { completado: false };
  }
}

function guardarCompletado() {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify({ completado: true }));
  } catch {
    // Sin persistencia el recorrido funciona igual, solo se vuelve a ofrecer.
  }
}

function medirVentana(): Ventana {
  if (typeof window === "undefined") return { ancho: 1024, alto: 768 };
  return { ancho: window.innerWidth, alto: window.innerHeight };
}

export function Tutorial({ rol }: { rol: Rol }) {
  const router = useRouter();
  const ruta = usePathname();

  /*
    El recorrido se arma segun el rol. Los pasos marcados soloAdmin apuntan a
    /admin/configuracion, que redirige a quien no sea administrador: dejarlos
    para todos convertiria dos pasos en un salto al resumen sin explicacion.
    Se memoriza porque el arreglo alimenta efectos, y uno nuevo en cada render
    los volveria a disparar.
  */
  const pasos = useMemo(
    () =>
      PASOS_TUTORIAL.filter((p) => {
        if (p.soloAdmin && rol !== "admin") return false;
        if (p.soloOperador && rol !== "admin" && rol !== "tecnico") return false;
        return true;
      }),
    [rol],
  );

  const [activo, setActivo] = useState(false);
  const [indice, setIndice] = useState(0);

  /*
    El recuadro se guarda junto al id del paso al que pertenece, y no suelto.
    Asi no hace falta limpiarlo al cambiar de paso, y se evita un parpadeo real:
    el foco se quedaba un instante sobre el elemento anterior porque el recuadro
    viejo seguia en estado hasta que el nuevo terminaba de medirse.
  */
  const [medido, setMedido] = useState<{ id: string; recuadro: Recuadro } | null>(null);

  /*
    Inicializado con lectura directa, no en un efecto. Antes arrancaba en un
    valor por defecto y se corregia despues, asi que el primer render de la
    tarjeta usaba la colocacion de escritorio y saltaba. En un telefono eso
    significaba una tarjeta de 380 px anclada a un elemento, fuera de pantalla,
    por un instante. El componente solo se monta en el cliente, asi que leer
    window aca es seguro.
  */
  const [ventana, setVentana] = useState<Ventana>(medirVentana);

  const tarjetaRef = useRef<HTMLDivElement>(null);
  const paso = pasos[indice];
  const ultimo = indice === pasos.length - 1;
  const angosto = ventana.ancho < 640;

  // Derivado, no almacenado: si la medicion es de otro paso, no vale.
  const recuadro = medido && paso && medido.id === paso.id ? medido.recuadro : null;

  useEffect(() => {
    const alRedimensionar = () => setVentana(medirVentana());
    window.addEventListener("resize", alRedimensionar);
    return () => window.removeEventListener("resize", alRedimensionar);
  }, []);

  /*
    Salir TAMBIEN se recuerda, no solo terminar.

    Antes solo se guardaba al llegar al final, asi que quien apretaba Salir en
    el paso 8 volvia al Resumen y el recorrido arrancaba de nuevo a los 700 ms,
    y como el paso 8 vive en /admin/activos, lo sacaba de la pantalla en la que
    estaba. Un tutorial que no acepta un no es un tutorial que se apaga
    borrando datos del navegador.
  */
  const cerrar = useCallback((_completado: boolean) => {
    setActivo(false);
    setMedido(null);
    guardarCompletado();
  }, []);

  /*
    Abrir el recorrido navega a la ruta del primer paso, asi que si hay un
    formulario a medio llenar se pierde lo tipeado. Se avisa antes, y solo en
    las rutas donde eso puede pasar: preguntar siempre seria ruido.
  */
  const abrir = useCallback(() => {
    const enFormulario = /\/(nueva|nuevo|etiquetas)$/.test(ruta);
    if (enFormulario && ruta !== "/admin") {
      const sigue = window.confirm(
        "El tutorial parte en el Resumen y vas a salir de esta pantalla. Si tienes algo a medio llenar, se pierde. ¿Abrir el tutorial igual?",
      );
      if (!sigue) return;
    }
    setIndice(0);
    setActivo(true);
  }, [ruta]);

  /* Arranque automatico, solo la primera vez y solo en el resumen. */
  useEffect(() => {
    if (ruta !== "/admin") return;
    if (leerEstado().completado) return;
    const t = setTimeout(() => setActivo(true), 700);
    return () => clearTimeout(t);
  }, [ruta]);

  /* El recorrido cruza rutas: si el paso vive en otra pantalla, se navega. */
  useEffect(() => {
    if (!activo || !paso) return;
    if (paso.ruta !== ruta) router.push(paso.ruta as "/admin");
  }, [activo, paso, ruta, router]);

  /* Anclaje: busca el elemento, lo trae a la vista y mide su recuadro. */
  useEffect(() => {
    if (!activo || !paso) return;
    if (!paso.ancla) return;
    if (paso.ruta !== ruta) return;

    const idPaso = paso.id;
    const esAngosto = angosto;
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
        /*
          En movil el elemento se lleva al tercio superior y no al centro,
          porque la hoja inferior ocupa la mitad baja de la pantalla y taparia
          justo lo que se esta senalando.
        */
        const r = el.getBoundingClientRect();
        const objetivo = esAngosto
          ? window.innerHeight * 0.2
          : window.innerHeight / 2 - r.height / 2;
        window.scrollBy({ top: r.top - objetivo, behavior: "smooth" });

        medir(el);
        setTimeout(() => !cancelado && medir(el), 400);
        return;
      }

      intentos += 1;
      // Agotados los intentos no se hace nada: sin medicion para este paso, la
      // tarjeta cae a hoja inferior con el mismo texto.
      if (intentos < INTENTOS_ANCLA) setTimeout(buscar, ESPERA_ANCLA);
    };

    buscar();
    return () => {
      cancelado = true;
    };
  }, [activo, paso, ruta, angosto]);

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

  /*
    Teclado: Escape sale, flechas y Enter avanzan.

    DOS GUARDAS QUE FALTABAN, y la primera provocaba un defecto grave. El
    recorrido dice textualmente "el elemento destacado sigue funcionando:
    pruebalo", asi que la gente lo usa. Con el tutorial abierto, escribir el
    codigo de confirmacion de un borrado y apretar Enter no enviaba el
    formulario: el manejador de aca lo interceptaba con preventDefault y
    avanzaba al paso siguiente.

    1. Si el foco esta en un campo de texto, el teclado es del campo.
    2. Si el evento viene de otro dialogo modal, el teclado es de ese dialogo.
       Los modales propios ya detienen la propagacion, pero esta guarda cubre
       cualquiera que se agregue despues sin acordarse de hacerlo.
  */
  useEffect(() => {
    if (!activo) return;

    const enCampo = (destino: EventTarget | null): boolean => {
      if (!(destino instanceof HTMLElement)) return false;
      if (destino.isContentEditable) return true;
      const etiqueta = destino.tagName;
      if (etiqueta === "INPUT" || etiqueta === "TEXTAREA" || etiqueta === "SELECT") return true;
      return Boolean(destino.closest("[role='dialog'][aria-modal='true']"));
    };

    const alPulsar = (e: KeyboardEvent) => {
      if (enCampo(e.target)) return;
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

  /*
    Un solo boton en el encabezado, que abre y cierra. Antes eran dos textos
    distintos, y "Cerrar tutorial" al lado de "Cerrar sesion" ocupaba un ancho
    que en pantalla chica empujaba el encabezado a tres lineas.
  */
  const boton = (
    <button
      type="button"
      onClick={() => (activo ? cerrar(false) : abrir())}
      aria-pressed={activo}
      className="shrink-0 rounded-md border border-primario px-3 py-2 text-sm font-semibold text-primario transition-colors hover:bg-primario hover:text-blanco print:hidden"
    >
      Tutorial
    </button>
  );

  if (!activo || !paso) return boton;

  /* Colocacion: hoja en movil, junto al elemento si cabe, centrada si no hay
     ancla, y hoja como respaldo cuando no hay espacio suficiente. */
  const colocacion: Colocacion = (() => {
    if (angosto) return { modo: "hoja" };
    if (!recuadro) return { modo: "centrada" };

    const espacioAbajo = ventana.alto - (recuadro.top + recuadro.height + MARGEN_FOCO) - 16;
    const espacioArriba = recuadro.top - MARGEN_FOCO - 16;

    const izquierda = Math.min(
      Math.max(12, recuadro.left + recuadro.width / 2 - ANCHO_TARJETA / 2),
      Math.max(12, ventana.ancho - ANCHO_TARJETA - 12),
    );

    if (espacioAbajo >= ALTO_MINIMO_TARJETA) {
      return {
        modo: "anclada",
        estilo: {
          top: recuadro.top + recuadro.height + MARGEN_FOCO + 12,
          left: izquierda,
          width: ANCHO_TARJETA,
          maxHeight: espacioAbajo,
        },
      };
    }

    if (espacioArriba >= ALTO_MINIMO_TARJETA) {
      return {
        modo: "anclada",
        estilo: {
          bottom: ventana.alto - recuadro.top + MARGEN_FOCO + 12,
          left: izquierda,
          width: ANCHO_TARJETA,
          maxHeight: espacioArriba,
        },
      };
    }

    // No cabe ni arriba ni abajo: hoja inferior. El foco sobre el elemento se
    // mantiene, que es lo que importa.
    return { modo: "hoja" };
  })();

  const velo = "fixed bg-negro/55 print:hidden";

  const contenido = (
    <>
      {/* Lo que el lector de pantalla anuncia al cambiar de paso. */}
      <p aria-live="polite" className="sr-only">
        Paso {indice + 1} de {pasos.length}: {paso.titulo}
      </p>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold tracking-widest text-primario uppercase">
          Paso {indice + 1} de {pasos.length}
        </p>
        <button
          type="button"
          onClick={() => cerrar(false)}
          className="-m-1 rounded p-1 text-sm font-semibold text-gris-500 hover:text-gris-900"
        >
          Salir
        </button>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-gris-200">
        <div
          className="h-full rounded-full bg-primario transition-[width] duration-300"
          style={{ width: `${((indice + 1) / pasos.length) * 100}%` }}
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

      {/*
        Los controles quedan pegados abajo y sobre fondo opaco: con la tarjeta
        con scroll propio, si se fueran con el contenido habria que desplazar
        para encontrar "Siguiente".
      */}
      <div className="sticky bottom-0 -mx-5 mt-4 flex items-center justify-between gap-3 border-t border-gris-100 bg-blanco px-5 pt-3">
        <button
          type="button"
          onClick={anterior}
          disabled={indice === 0}
          className="rounded-md border border-gris-300 px-3 py-2.5 text-sm font-semibold text-gris-800 disabled:opacity-40"
        >
          Anterior
        </button>

        <button
          type="button"
          onClick={siguiente}
          className="rounded-md bg-primario px-5 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90"
        >
          {ultimo ? "Terminar" : "Siguiente"}
        </button>
      </div>

      {/* La ayuda de teclado no aplica en un telefono. */}
      <p className="mt-3 hidden text-xs text-gris-500 sm:block">
        Puedes usar las flechas del teclado, y Escape para salir. El elemento
        destacado sigue funcionando: pruébalo si quieres.
      </p>
    </>
  );

  const claseTarjeta =
    "rounded-xl border border-gris-200 bg-blanco p-5 shadow-elevada outline-none overflow-y-auto overscroll-contain print:hidden";

  return (
    <>
      {boton}

      {recuadro ? (
        <div aria-hidden="true" className="fixed inset-0 z-40 print:hidden">
          <div
            className={velo}
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, recuadro.top - MARGEN_FOCO) }}
          />
          <div
            className={velo}
            style={{
              top: recuadro.top + recuadro.height + MARGEN_FOCO,
              left: 0,
              right: 0,
              bottom: 0,
            }}
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
        <div
          aria-hidden="true"
          onClick={() => cerrar(false)}
          className="fixed inset-0 z-40 bg-negro/55 print:hidden"
        />
      )}

      {colocacion.modo === "centrada" ? (
        /*
          Centrada con flex y no con translateY(-50%). Con transform, una
          tarjeta mas alta que el viewport se sale por arriba y su encabezado
          queda inalcanzable. Con flex mas alto maximo, se ajusta y aparece el
          scroll.
        */
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-3 print:hidden">
          <div
            ref={tarjetaRef}
            role="dialog"
            aria-labelledby="tutorial-titulo"
            aria-describedby="tutorial-texto"
            tabIndex={-1}
            className={`pointer-events-auto w-full max-w-[380px] max-h-[calc(100dvh-24px)] ${claseTarjeta}`}
          >
            {contenido}
          </div>
        </div>
      ) : colocacion.modo === "hoja" ? (
        /* Hoja inferior: ancho completo, esquinas superiores redondeadas, y
           respeto por el area segura de los telefonos con notch. */
        <div
          ref={tarjetaRef}
          role="dialog"
          aria-labelledby="tutorial-titulo"
          aria-describedby="tutorial-texto"
          tabIndex={-1}
          className={`fixed bottom-0 left-0 right-0 z-50 max-h-[72dvh] rounded-b-none pb-[calc(1.25rem+env(safe-area-inset-bottom))] ${claseTarjeta}`}
        >
          {contenido}
        </div>
      ) : (
        <div
          ref={tarjetaRef}
          role="dialog"
          aria-labelledby="tutorial-titulo"
          aria-describedby="tutorial-texto"
          tabIndex={-1}
          className={`fixed z-50 max-w-[calc(100vw-24px)] ${claseTarjeta}`}
          style={colocacion.estilo}
        >
          {contenido}
        </div>
      )}
    </>
  );
}
