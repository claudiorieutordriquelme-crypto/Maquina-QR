import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { TipoMantencion } from "@/lib/tipos";

/*
  Acceso a ordenes de mantencion desde el panel.

  Todo pasa por el cliente con sesion, asi que cada lectura y cada escritura se
  evalua contra RLS con el JWT de quien opera.
*/

export type EstadoOrden = "programada" | "en_ejecucion" | "completada" | "anulada";

export type Orden = {
  id: string;
  folio: number;
  activo_id: string;
  plan_id: string | null;
  tipo: TipoMantencion;
  estado: EstadoOrden;
  fecha_programada: string | null;
  fecha_ejecucion: string | null;
  horometro_ejecucion: number | null;
  kilometraje_ejecucion: number | null;
  descripcion_trabajo: string;
  causa_falla: string | null;
  proveedor_id: string | null;
  ejecutor_interno: string | null;
  numero_factura: string | null;
  fecha_factura: string | null;
  monto_mano_obra: number;
  monto_repuestos: number;
  monto_otros: number;
  costo_total: number;
  tiempo_fuera_servicio_horas: number | null;
};

export type OrdenListada = Orden & {
  activo_nombre: string;
  activo_codigo: string;
  proveedor_nombre: string | null;
  plan_nombre: string | null;
};

export type LineaRepuesto = {
  id: string;
  orden_id: string;
  repuesto_id: string | null;
  descripcion_libre: string | null;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
  repuesto_nombre: string | null;
  repuesto_unidad: string | null;
};

export type DocumentoOrden = {
  id: string;
  tipo_documento: string;
  nombre_archivo: string;
  storage_path: string;
  bucket: string;
  mime_type: string | null;
  tamano_bytes: number | null;
  created_at: string;
};

export type FiltrosOrdenes = {
  tipo?: string;
  estado?: string;
  proveedor?: string;
  desde?: string;
  hasta?: string;
};

export const ETIQUETA_ESTADO_ORDEN: Record<EstadoOrden, string> = {
  programada: "Programada",
  en_ejecucion: "En ejecución",
  completada: "Completada",
  anulada: "Anulada",
};

export const listarProveedores = cache(async (): Promise<{ id: string; nombre: string }[]> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("proveedores")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  if (error) {
    console.error("No pude leer los proveedores:", error.message);
    return [];
  }
  return data ?? [];
});

export const listarRepuestos = cache(
  async (): Promise<
    { id: string; codigo: string; nombre: string; unidad_medida: string; costo_unitario_referencia: number; stock_actual: number }[]
  > => {
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase
      .from("repuestos")
      .select("id, codigo, nombre, unidad_medida, costo_unitario_referencia, stock_actual")
      .eq("activo", true)
      .order("nombre");
    if (error) {
      console.error("No pude leer los repuestos:", error.message);
      return [];
    }
    return data ?? [];
  },
);

export const listarActivosSimple = cache(
  async (): Promise<{ id: string; nombre: string; codigo_interno: string }[]> => {
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase
      .from("activos")
      .select("id, nombre, codigo_interno")
      .neq("estado", "dado_de_baja")
      .order("codigo_interno");
    if (error) {
      console.error("No pude leer los activos:", error.message);
      return [];
    }
    return data ?? [];
  },
);

export async function listarPlanesDeActivo(
  activoId: string,
): Promise<{ id: string; nombre: string }[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("planes_mantencion")
    .select("id, nombre")
    .eq("activo_id", activoId)
    .eq("activo", true)
    .order("nombre");
  if (error) {
    console.error("No pude leer los planes:", error.message);
    return [];
  }
  return data ?? [];
}

/*
  Listado de ordenes. Los filtros se aplican en la consulta y no en memoria,
  porque el historial de ordenes crece sin techo: es una fila por intervencion
  de cada maquina, para siempre.
*/
export async function listarOrdenes(
  filtros: FiltrosOrdenes = {},
): Promise<{ ordenes: OrdenListada[]; error: string | null }> {
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("ordenes_mantencion")
    .select(
      "*, activos!inner(nombre, codigo_interno), proveedores(nombre), planes_mantencion(nombre)",
    )
    .order("fecha_ejecucion", { ascending: false, nullsFirst: false })
    .order("folio", { ascending: false })
    .limit(200);

  if (filtros.tipo) consulta = consulta.eq("tipo", filtros.tipo);
  if (filtros.estado) consulta = consulta.eq("estado", filtros.estado);
  if (filtros.proveedor) consulta = consulta.eq("proveedor_id", filtros.proveedor);
  if (filtros.desde) consulta = consulta.gte("fecha_ejecucion", filtros.desde);
  if (filtros.hasta) consulta = consulta.lte("fecha_ejecucion", filtros.hasta);

  const { data, error } = await consulta;
  if (error) return { ordenes: [], error: error.message };

  type Fila = Orden & {
    activos: { nombre: string; codigo_interno: string } | null;
    proveedores: { nombre: string } | null;
    planes_mantencion: { nombre: string } | null;
  };

  const ordenes = ((data ?? []) as Fila[]).map((o) => ({
    ...o,
    activo_nombre: o.activos?.nombre ?? "(activo eliminado)",
    activo_codigo: o.activos?.codigo_interno ?? "",
    proveedor_nombre: o.proveedores?.nombre ?? null,
    plan_nombre: o.planes_mantencion?.nombre ?? null,
  }));

  return { ordenes, error: null };
}

export async function obtenerOrden(id: string): Promise<{
  orden: OrdenListada | null;
  lineas: LineaRepuesto[];
  documentos: DocumentoOrden[];
}> {
  const supabase = await crearClienteServidor();

  const [resOrden, resLineas, resDocs] = await Promise.all([
    supabase
      .from("ordenes_mantencion")
      .select("*, activos(nombre, codigo_interno), proveedores(nombre), planes_mantencion(nombre)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("orden_repuestos")
      .select("*, repuestos(nombre, unidad_medida)")
      .eq("orden_id", id)
      .order("created_at"),
    supabase
      .from("documentos")
      .select("id, tipo_documento, nombre_archivo, storage_path, bucket, mime_type, tamano_bytes, created_at")
      .eq("entidad_tipo", "orden")
      .eq("entidad_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (resOrden.error || !resOrden.data) {
    if (resOrden.error) console.error("No pude leer la orden:", resOrden.error.message);
    return { orden: null, lineas: [], documentos: [] };
  }

  const o = resOrden.data as Orden & {
    activos: { nombre: string; codigo_interno: string } | null;
    proveedores: { nombre: string } | null;
    planes_mantencion: { nombre: string } | null;
  };

  const lineas = ((resLineas.data ?? []) as (LineaRepuesto & {
    repuestos: { nombre: string; unidad_medida: string } | null;
  })[]).map((l) => ({
    ...l,
    repuesto_nombre: l.repuestos?.nombre ?? null,
    repuesto_unidad: l.repuestos?.unidad_medida ?? null,
  }));

  return {
    orden: {
      ...o,
      activo_nombre: o.activos?.nombre ?? "(activo eliminado)",
      activo_codigo: o.activos?.codigo_interno ?? "",
      proveedor_nombre: o.proveedores?.nombre ?? null,
      plan_nombre: o.planes_mantencion?.nombre ?? null,
    },
    lineas,
    documentos: (resDocs.data ?? []) as DocumentoOrden[],
  };
}

/*
  Todos los planes activos, con su activo. El formulario de alta los agrupa por
  activo con optgroup: filtrarlos segun el activo elegido exigiria estado de
  cliente y una segunda consulta, y agruparlos resuelve lo mismo sin JavaScript.
*/
export const listarTodosLosPlanes = cache(
  async (): Promise<{ id: string; nombre: string; activo_id: string }[]> => {
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase
      .from("planes_mantencion")
      .select("id, nombre, activo_id")
      .eq("activo", true)
      .order("nombre");
    if (error) {
      console.error("No pude leer los planes:", error.message);
      return [];
    }
    return data ?? [];
  },
);
