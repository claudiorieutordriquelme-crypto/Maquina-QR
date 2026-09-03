import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonImprimir } from "@/components/boton-imprimir";
import { EtiquetaQr } from "@/components/etiqueta-qr";
import { obtenerActivo } from "@/lib/datos/activos";
import { baseParaQr, urlFicha } from "@/lib/qr";

export const dynamic = "force-dynamic";

/*
  Estilos de los dos botones secundarios. Se comparten para que no se separen:
  dos botones del mismo nivel que se ven distinto obligan a decidir cual pesa
  mas, y ninguno pesa mas.
*/
const claseSecundario =
  "inline-flex items-center gap-2 rounded-lg border border-gris-300 bg-blanco px-5 py-3 text-sm font-semibold text-gris-800 transition-colors hover:border-primario hover:text-primario";

export default async function QrActivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activo = await obtenerActivo(id);
  if (!activo) notFound();

  const { base } = await baseParaQr();
  const url = urlFicha(base, activo.qr_token);

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link href="/admin/activos" className="text-sm font-semibold text-primario hover:underline">
          Volver a activos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gris-900">Etiqueta QR</h1>
        <p className="mt-1 text-base text-gris-600">
          {activo.nombre} · {activo.codigo_interno}
        </p>
      </div>

      {/*
        Un activo dado de baja sale de la vista publica: get_ficha_publica
        responde null y la ruta da 404. Su etiqueta se puede seguir imprimiendo
        desde aca, y antes no avisaba nada, asi que se podia pegar en una maquina
        un codigo que no lleva a ninguna parte.
      */}
      {activo.estado === "dado_de_baja" ? (
        <div className="flex overflow-hidden rounded-lg border border-gris-200 print:hidden">
          <div className="w-2 shrink-0 bg-acento" aria-hidden="true" />
          <div className="p-4">
            <h2 className="text-sm font-bold text-gris-900">
              Este activo está dado de baja: su código QR no funciona
            </h2>
            <p className="mt-1.5 max-w-prose text-sm text-gris-600">
              La ficha pública de un activo dado de baja responde “no
              encontrado”. Si imprimes y pegas esta etiqueta, quien la escanee no
              va a ver nada. Para que vuelva a funcionar, cambia el estado del
              activo en su ficha.
            </p>
          </div>
        </div>
      ) : null}

      {/*
        La etiqueta va centrada sobre un fondo gris que hace de mesa: separa la
        vista previa del resto de la pantalla sin encerrarla en otro marco, y en
        papel se desarma entero para no gastar tinta.

        En pantalla se centra; impresa se alinea a la izquierda, que es donde
        conviene que salga un adhesivo de 70 mm para recortarlo.
      */}
      <section className="rounded-xl border border-gris-200 bg-gris-50 px-4 py-8 sm:px-6 sm:py-10 print:border-0 print:bg-transparent print:p-0">
        <div className="zona-impresion flex justify-center print:justify-start">
          <EtiquetaQr
            base={base}
            nombre={activo.nombre}
            codigoInterno={activo.codigo_interno}
            token={activo.qr_token}
          />
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3 print:hidden">
          <BotonImprimir etiqueta="Imprimir esta etiqueta" />

          {/*
            Abrir la ficha es ademas la forma de comprobar a donde apunta el
            codigo antes de pegarlo en una maquina.
          */}
          <a href={url} target="_blank" rel="noreferrer" className={claseSecundario}>
            <svg viewBox="0 0 20 20" className="size-4 shrink-0 fill-current" aria-hidden="true">
              <path d="M11 2h7v7h-2V5.4l-7.3 7.3-1.4-1.4L14.6 4H11z" />
              <path d="M4 4h5v2H4v10h10v-5h2v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
            </svg>
            Abrir la ficha pública
          </a>

          <Link href="/admin/activos/etiquetas" className={claseSecundario}>
            <svg viewBox="0 0 20 20" className="size-4 shrink-0 fill-current" aria-hidden="true">
              <path d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z" />
            </svg>
            Impresión masiva
          </Link>
        </div>
      </section>

      <p className="max-w-prose text-sm text-gris-500 print:hidden">
        La etiqueta mide 70 por 50 milímetros. En pantalla se ve del mismo tamaño
        que va a salir impresa. Conviene imprimirla en papel adhesivo y, si la
        máquina trabaja a la intemperie, protegerla con cinta transparente: el
        código tolera hasta un 25% de daño, pero no el barro que lo tape del todo.
      </p>
    </div>
  );
}
