import { PERMISOS, requiereRol } from "@/lib/auth";
import { cargarReportes, type CorteCosto } from "@/lib/datos/reportes";

/*
  Exportacion a CSV de los tres cortes de costo.

  Va como Route Handler y no como Server Action porque el resultado es un
  archivo que el navegador descarga, no una mutacion. Un enlace normal basta, y
  eso lo hace funcionar sin JavaScript.

  DOS DETALLES QUE DECIDEN SI EL ARCHIVO SIRVE EN CHILE:

  1. Separador punto y coma, no coma. Excel con configuracion regional es-CL
     usa el punto y coma como separador de listas. Con comas, todo el archivo
     aterriza en una sola columna y el usuario concluye que el sistema exporta
     mal. Se declara ademas con la linea sep=; que Excel respeta.
  2. BOM de UTF-8 al inicio. Sin el, Excel abre el archivo en la codificacion
     del sistema y "Mantención" se lee "MantenciÃ³n". Tres bytes que evitan que
     todo el reporte se vea roto.

  Los numeros salen sin separador de miles y sin simbolo de moneda, para que
  Excel los reconozca como numeros y se puedan sumar. Formatearlos aca los
  convertiria en texto.
*/

const CORTES = ["activo", "tipo", "proveedor"] as const;
type Corte = (typeof CORTES)[number];

const TITULO: Record<Corte, string> = {
  activo: "Activo",
  tipo: "Tipo de mantención",
  proveedor: "Proveedor",
};

/*
  Comillas dobles solo cuando hacen falta, y las internas se duplican. Un
  nombre de proveedor con punto y coma o con salto de linea romperia el archivo
  sin esto, y los nombres de fantasia traen de todo.
*/
function celda(valor: string | number): string {
  const s = String(valor);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function armarCsv(corte: Corte, filas: CorteCosto[], total: number): string {
  const lineas = [
    "sep=;",
    [TITULO[corte], "Órdenes", "Costo total", "Participación en el costo"]
      .map(celda)
      .join(";"),
    ...filas.map((f) =>
      [
        f.etiqueta,
        f.ordenes,
        Math.round(f.costo),
        total > 0 ? `${((f.costo / total) * 100).toFixed(1)}%` : "0%",
      ]
        .map(celda)
        .join(";"),
    ),
    [
      "Total",
      filas.reduce((s, f) => s + f.ordenes, 0),
      Math.round(total),
      total > 0 ? "100%" : "0%",
    ]
      .map(celda)
      .join(";"),
  ];

  // \r\n porque es lo que Excel espera en un CSV.
  /*
    El BOM va escrito como escape y no como caracter literal. Un caracter
    invisible al comienzo de una cadena sobrevive mal a un formateador, a un
    editor que normalice el archivo o a un copiar y pegar, y sin el Excel abre
    el CSV en la codificacion del sistema: Mantención se lee MantenciÃ³n.
  */
  return "\uFEFF" + lineas.join("\r\n") + "\r\n";
}

export async function GET(peticion: Request) {
  /*
    El rol se verifica aca tambien. Un Route Handler es un endpoint HTTP y se
    puede pedir directo, sin pasar por ninguna pantalla: que el enlace este
    oculto no protege nada. La base ademas aplica RLS, asi que el archivo solo
    puede contener lo que esta sesion puede leer.
  */
  try {
    await requiereRol(PERMISOS.leer);
  } catch {
    return new Response("No autorizado", { status: 403 });
  }

  const url = new URL(peticion.url);
  const bruto = url.searchParams.get("corte") ?? "activo";
  const corte = (CORTES as readonly string[]).includes(bruto) ? (bruto as Corte) : "activo";
  const desde = url.searchParams.get("desde") ?? undefined;
  const hasta = url.searchParams.get("hasta") ?? undefined;

  const reportes = await cargarReportes({ desde, hasta });
  if (reportes.error) {
    console.error("No pude armar el CSV:", reportes.error);
    return new Response("No pude generar el reporte", { status: 500 });
  }

  const filas =
    corte === "activo"
      ? reportes.porActivo
      : corte === "tipo"
        ? reportes.porTipo
        : reportes.porProveedor;

  /*
    El nombre del archivo se sanea antes de pegarlo en Content-Disposition. Los
    parametros desde y hasta vienen de la URL y no estaban validados: una
    comilla en desde permitia cerrar el filename y agregar otro, y el navegador
    guardaba el CSV con el nombre y la extension que dijera el segundo. Aca solo
    sobreviven digitos y guiones, que es todo lo que una fecha necesita.
  */
  const limpia = (v: string | undefined) => (v ?? "").replace(/[^0-9-]/g, "").slice(0, 10);
  const periodo = [limpia(desde), limpia(hasta)].filter(Boolean).join("_a_") || "todo";
  const nombre = `mantencion_por_${corte}_${periodo}.csv`;

  return new Response(armarCsv(corte, filas, reportes.totalCosto), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      // Un reporte de costos no se cachea en ningun intermediario.
      "Cache-Control": "private, no-store",
    },
  });
}
