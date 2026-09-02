import Link from "next/link";
import { BotonImprimir } from "@/components/boton-imprimir";
import { SECCIONES_GUIA, type Seccion } from "./contenido";

/*
  Guia de uso, paso a paso, por seccion.

  Vive dentro del panel y no en un documento aparte por una razon practica: una
  guia en un archivo adjunto no la abre nadie cuando esta trabajando. Aca esta a
  un clic de la pantalla que se esta usando.

  Se puede imprimir. En una faena con senal mala, una hoja pegada en la pared de
  la oficina de mantencion sirve mas que cualquier tutorial.

  Estatica a proposito: no consulta la base, asi que no depende de la sesion ni
  de que Supabase responda. Es lo que uno quiere de una guia justo cuando algo
  no esta funcionando.
*/
export const metadata = {
  title: "Guía de uso · Máquina QR",
  robots: { index: false, follow: false },
};

function Bloque({ seccion, numero }: { seccion: Seccion; numero: number }) {
  return (
    <section id={seccion.id} className="scroll-mt-32 border-t border-gris-200 pt-8">
      <header>
        <p className="text-xs font-bold tracking-widest text-primario uppercase">
          Sección {numero}
        </p>
        <h2 className="mt-1 text-xl font-bold text-gris-900 sm:text-2xl">{seccion.nombre}</h2>
        <p className="mt-1 font-mono text-sm text-gris-500">{seccion.ruta}</p>
        <p className="mt-3 max-w-prose text-base text-gris-700">{seccion.sirve}</p>
      </header>

      <ol className="mt-6 space-y-4">
        {seccion.pasos.map((paso, i) => (
          <li key={paso.titulo} className="flex gap-3 sm:gap-4">
            {/* El numero va en un circulo y no como marcador de lista para que
                se pueda leer de reojo desde una hoja impresa. */}
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-primario text-sm font-bold text-primario"
            >
              {i + 1}
            </span>

            <div className="min-w-0">
              <h3 className="text-base font-bold text-gris-900">{paso.titulo}</h3>
              <p className="mt-1 text-sm text-gris-700">
                <span className="font-semibold">Qué ves: </span>
                {paso.ves}
              </p>
              <p className="mt-1 text-sm text-gris-600">
                <span className="font-semibold">Qué pasa: </span>
                {paso.pasa}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-gris-200 p-4">
          <h3 className="text-xs font-bold tracking-widest text-gris-500 uppercase">
            Quién puede
          </h3>
          <p className="mt-2 text-sm text-gris-700">{seccion.quien}</p>
        </div>

        {/* Las advertencias llevan la franja de acento: son lo que evita perder
            trabajo, no un adorno de documentacion. */}
        <div className="flex overflow-hidden rounded-lg border border-gris-200">
          <div className="w-2 shrink-0 bg-acento" aria-hidden="true" />
          <div className="min-w-0 p-4">
            <h3 className="text-xs font-bold tracking-widest text-gris-500 uppercase">Ojo con</h3>
            <ul className="mt-2 space-y-2 text-sm text-gris-700">
              {seccion.ojo.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex overflow-hidden rounded-lg border border-gris-200">
          <div className="w-2 shrink-0 bg-gris-300" aria-hidden="true" />
          <div className="min-w-0 p-4">
            <h3 className="text-xs font-bold tracking-widest text-gris-500 uppercase">
              Todavía no hace
            </h3>
            <ul className="mt-2 space-y-2 text-sm text-gris-700">
              {seccion.falta.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function GuiaPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gris-900 sm:text-3xl">Guía de uso</h1>
        <p className="mt-2 max-w-prose text-base text-gris-700">
          Qué hace cada sección y cómo se usa, paso a paso. Cada sección incluye
          quién puede hacer qué, las advertencias que evitan perder trabajo, y lo
          que todavía no está construido.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          <BotonImprimir etiqueta="Imprimir la guía" />
          <Link
            href="/admin"
            className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800 transition-colors hover:border-gris-500"
          >
            Volver al resumen
          </Link>
        </div>
      </header>

      {/*
        Indice con anclas. En una guia de nueve secciones, sin indice la gente
        no la usa: la abre, ve un muro de texto y la cierra.
      */}
      <nav aria-label="Secciones de la guía" className="rounded-lg border border-gris-200 p-4">
        <h2 className="text-xs font-bold tracking-widest text-gris-500 uppercase">Contenido</h2>
        <ol className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {SECCIONES_GUIA.map((s, i) => (
            <li key={s.id} className="flex gap-2 text-sm">
              <span className="font-semibold text-gris-400">{i + 1}.</span>
              <a href={`#${s.id}`} className="font-semibold text-primario hover:underline">
                {s.nombre}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {SECCIONES_GUIA.map((s, i) => (
        <Bloque key={s.id} seccion={s} numero={i + 1} />
      ))}

      <footer className="border-t border-gris-200 pt-6 text-sm text-gris-500">
        <p className="max-w-prose">
          Esta guía se escribió leyendo el código de cada pantalla, no de memoria:
          un agente por sección describió lo que la pantalla hace, y otro trató de
          refutar esa descripción contra el mismo código. Las nueve volvieron con
          correcciones, y varias eran errores reales que se arreglaron antes de
          publicar esto.
        </p>
        <p className="mt-2 max-w-prose">
          Si una pantalla cambia y esta guía no, avísalo: lo que más rápido
          envejece es la lista de “todavía no hace”.
        </p>
      </footer>
    </div>
  );
}
