import Link from "next/link";
import { BotonImprimir } from "@/components/boton-imprimir";
import { EtiquetaQr } from "@/components/etiqueta-qr";
import { listarParaEtiquetas } from "@/lib/datos/activos";
import { baseParaQr } from "@/lib/qr";

/*
  Impresion masiva de etiquetas.

  Sirve para dar de alta una flota completa de una pasada: se imprime la hoja, se
  cortan las etiquetas y se pegan. Sin esto, cada activo obliga a entrar a su
  ficha y mandar a imprimir de a una, que con 40 maquinas es media manana.

  Los activos dados de baja quedan fuera: su ficha publica responde 404, asi que
  imprimir su etiqueta seria imprimir un codigo que no lleva a ninguna parte.
*/
export const dynamic = "force-dynamic";

export default async function EtiquetasPage() {
  const [activos, { base, origen }] = await Promise.all([listarParaEtiquetas(), baseParaQr()]);

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link href="/admin/activos" className="text-sm font-semibold text-primario hover:underline">
          Volver a activos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gris-900">Impresión de etiquetas</h1>
        <p className="mt-1 text-base text-gris-600">
          {activos.length} {activos.length === 1 ? "etiqueta" : "etiquetas"}, una por activo
          operativo. Entran seis por hoja.
        </p>
      </div>

      <div className="rounded-lg border border-gris-200 p-4 print:hidden">
        <p className="text-xs font-bold tracking-widest text-gris-500 uppercase">
          Todos los códigos apuntan a
        </p>
        <p className="mt-1 font-mono text-sm break-all text-gris-900">{base}/a/…</p>
        <p className="mt-2 text-sm text-gris-600">
          Base tomada de la {origen}.{" "}
          <span className="font-semibold text-gris-900">
            Revísala antes de mandar a imprimir.
          </span>{" "}
          Si el dominio cambia después, hay que reimprimir y volver a pegar cada
          etiqueta, una por una.
        </p>
      </div>

      <div className="print:hidden">
        <BotonImprimir etiqueta={`Imprimir ${activos.length} etiquetas`} />
      </div>

      {activos.length === 0 ? (
        <p className="rounded-lg border border-gris-200 p-6 text-base text-gris-600 print:hidden">
          No hay activos operativos que etiquetar.
        </p>
      ) : (
        <div className="zona-impresion flex flex-wrap gap-[4mm]">
          {activos.map((a) => (
            <EtiquetaQr
              key={a.id}
              base={base}
              nombre={a.nombre}
              codigoInterno={a.codigo_interno}
              token={a.qr_token}
            />
          ))}
        </div>
      )}
    </div>
  );
}
