import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonImprimir } from "@/components/boton-imprimir";
import { EtiquetaQr } from "@/components/etiqueta-qr";
import { obtenerActivo } from "@/lib/datos/activos";
import { baseParaQr, urlFicha } from "@/lib/qr";

export const dynamic = "force-dynamic";

export default async function QrActivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activo = await obtenerActivo(id);
  if (!activo) notFound();

  const { base, origen } = await baseParaQr();
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
        La URL codificada se muestra grande y antes del boton de imprimir, a
        proposito. Es la unica proteccion real contra imprimir una flota entera
        contra el dominio equivocado: si el dominio cambia despues, cada etiqueta
        pegada queda apuntando a una URL muerta y hay que reimprimir una por una.
        Que la persona lea esta linea vale mas que cualquier variable de entorno.
      */}
      <div className="rounded-lg border border-gris-200 p-4 print:hidden">
        <p className="text-xs font-bold tracking-widest text-gris-500 uppercase">
          El QR apunta a
        </p>
        <p className="mt-1 font-mono text-sm break-all text-gris-900">{url}</p>
        <p className="mt-2 text-sm text-gris-600">
          Base tomada de la {origen}.
          {origen === "dominio de esta visita" ? (
            <>
              {" "}
              <span className="font-semibold text-gris-900">
                Revísala antes de imprimir:
              </span>{" "}
              si estás en un deployment de vista previa, esa URL deja de existir
              cuando el deployment se borra. Para fijarla, carga
              <span className="font-mono"> NEXT_PUBLIC_APP_URL</span> en el
              entorno.
            </>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <BotonImprimir etiqueta="Imprimir esta etiqueta" />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800 transition-colors hover:border-gris-500"
        >
          Abrir la ficha pública
        </a>
        <Link
          href="/admin/activos/etiquetas"
          className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800 transition-colors hover:border-gris-500"
        >
          Impresión masiva
        </Link>
      </div>

      <div className="zona-impresion">
        <EtiquetaQr
          base={base}
          nombre={activo.nombre}
          codigoInterno={activo.codigo_interno}
          token={activo.qr_token}
        />
      </div>

      <p className="max-w-prose text-sm text-gris-500 print:hidden">
        La etiqueta mide 70 por 50 milímetros. En pantalla se ve del mismo tamaño
        que va a salir impresa. Conviene imprimirla en papel adhesivo y, si la
        máquina trabaja a la intemperie, protegerla con cinta transparente: el
        código tolera hasta un 25% de daño, pero no el barro que lo tape del todo.
      </p>
    </div>
  );
}
