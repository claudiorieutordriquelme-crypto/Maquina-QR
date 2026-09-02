import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoActivo, Semaforo } from "@/lib/tipos";

/*
  Acceso a activos desde el panel privado.

  Todo pasa por el cliente con sesion, asi que cada consulta se evalua contra
  las politicas RLS con el JWT de quien mira. No hay filtro de permisos en este
  archivo a proposito: si un lector no debe ver algo, lo decide la base.
*/

export type TipoActivo = {
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
};

export type Activo = {
  id: string;
  nombre: string;
  codigo_interno: string;
  patente: string | null;
  numero_serie: string | null;
  numero_chasis: string | null;
  tipo_codigo: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  ubicacion: string | null;
  estado: EstadoActivo;
  horometro_actual: number | null;
  kilometraje_actual: number | null;
  fecha_adquisicion: string | null;
  valor_adquisicion: number | null;
  foto_path: string | null;
  qr_token: string;
  notas: string | null;
};

/** Activo mas el peor semaforo de sus planes, para el listado. */
export type ActivoConEstado = Activo & {
  tipo_nombre: string | null;
  semaforo: Semaforo | null;
  planes: number;
};

export type FiltrosActivos = {
  tipo?: string;
  estado?: string;
  ubicacion?: string;
  semaforo?: string;
};

const PESO_SEMAFORO: Record<Semaforo, number> = {
  vencida: 1,
  critica: 2,
  proxima: 3,
  al_dia: 4,
  sin_linea_base: 5,
};

export const listarTiposActivo = cache(async (): Promise<TipoActivo[]> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("tipos_activo")
    .select("codigo, nombre, orden, activo")
    .eq("activo", true)
    .order("orden")
    .order("nombre");

  if (error) {
    console.error("No pude leer los tipos de activo:", error.message);
    return [];
  }
  return (data ?? []) as TipoActivo[];
});

/*
  El semaforo del activo es el peor de sus planes: si uno esta vencido, el
  activo esta vencido, aunque los otros dos esten al dia. Cualquier otra
  agregacion (promedio, el mas comun) esconderia exactamente lo que hay que ver.

  La combinacion se hace en memoria y no en SQL porque son dos consultas
  independientes con volumenes chicos. Cuando la flota crezca, esto se convierte
  en una vista que ya agregue por activo.
*/
export async function listarActivos(filtros: FiltrosActivos = {}): Promise<{
  activos: ActivoConEstado[];
  ubicaciones: string[];
  error: string | null;
}> {
  const supabase = await crearClienteServidor();

  const [resActivos, resEstados, resTipos] = await Promise.all([
    supabase.from("activos").select("*").order("codigo_interno"),
    supabase.from("v_estado_mantencion").select("activo_id, semaforo"),
    listarTiposActivo(),
  ]);

  const error = resActivos.error?.message ?? resEstados.error?.message ?? null;
  if (error) return { activos: [], ubicaciones: [], error };

  const nombreTipo = new Map(resTipos.map((t) => [t.codigo, t.nombre]));

  const peorPorActivo = new Map<string, { semaforo: Semaforo; planes: number }>();
  for (const fila of (resEstados.data ?? []) as { activo_id: string; semaforo: Semaforo | null }[]) {
    if (!fila.semaforo) continue;
    const previo = peorPorActivo.get(fila.activo_id);
    const planes = (previo?.planes ?? 0) + 1;
    const peor =
      previo && PESO_SEMAFORO[previo.semaforo] <= PESO_SEMAFORO[fila.semaforo]
        ? previo.semaforo
        : fila.semaforo;
    peorPorActivo.set(fila.activo_id, { semaforo: peor, planes });
  }

  let activos: ActivoConEstado[] = ((resActivos.data ?? []) as Activo[]).map((a) => ({
    ...a,
    tipo_nombre: nombreTipo.get(a.tipo_codigo) ?? null,
    semaforo: peorPorActivo.get(a.id)?.semaforo ?? null,
    planes: peorPorActivo.get(a.id)?.planes ?? 0,
  }));

  const ubicaciones = [...new Set(activos.map((a) => a.ubicacion).filter((u): u is string => !!u))].sort();

  if (filtros.tipo) activos = activos.filter((a) => a.tipo_codigo === filtros.tipo);
  if (filtros.estado) activos = activos.filter((a) => a.estado === filtros.estado);
  if (filtros.ubicacion) activos = activos.filter((a) => a.ubicacion === filtros.ubicacion);
  if (filtros.semaforo) activos = activos.filter((a) => a.semaforo === filtros.semaforo);

  return { activos, ubicaciones, error: null };
}

export const obtenerActivo = cache(async (id: string): Promise<Activo | null> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("activos").select("*").eq("id", id).maybeSingle();

  if (error) {
    console.error("No pude leer el activo:", error.message);
    return null;
  }
  return (data as Activo | null) ?? null;
});

/** Para la impresion masiva: solo lo que entra en una etiqueta. */
export async function listarParaEtiquetas(ids?: string[]): Promise<
  { id: string; nombre: string; codigo_interno: string; qr_token: string; tipo_codigo: string }[]
> {
  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("activos")
    .select("id, nombre, codigo_interno, qr_token, tipo_codigo")
    .neq("estado", "dado_de_baja")
    .order("codigo_interno");

  if (ids && ids.length > 0) consulta = consulta.in("id", ids);

  const { data, error } = await consulta;
  if (error) {
    console.error("No pude leer los activos para etiquetas:", error.message);
    return [];
  }
  return data ?? [];
}

export type PlanDeActivo = {
  id: string;
  nombre: string;
  intervalo_dias: number | null;
  intervalo_horas: number | null;
  descripcion_tareas: string | null;
  activo: boolean;
  semaforo: Semaforo | null;
  proxima_fecha: string | null;
  dias_restantes: number | null;
  horas_restantes: number | null;
  disparador: "fecha" | "horas" | null;
};

export type LecturaUso = {
  id: string;
  fecha: string;
  horometro: number | null;
  kilometraje: number | null;
};

/*
  Detalle de un activo, con todo lo que cuelga de el.

  El conteo de ordenes no es informativo: decide si el activo se puede borrar.
  La foreign key de ordenes_mantencion hacia activos es RESTRICT, asi que la
  base impide borrar una maquina con historial. Los planes y las lecturas si van
  en CASCADE, o sea se borran con ella.
*/
export async function obtenerDetalleActivo(id: string): Promise<{
  activo: Activo | null;
  tipo_nombre: string | null;
  planes: PlanDeActivo[];
  lecturas: LecturaUso[];
  ordenes: number;
}> {
  const supabase = await crearClienteServidor();

  const [resActivo, resPlanes, resEstado, resLecturas, resOrdenes, tipos] = await Promise.all([
    supabase.from("activos").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("planes_mantencion")
      .select("id, nombre, intervalo_dias, intervalo_horas, descripcion_tareas, activo")
      .eq("activo_id", id)
      .order("nombre"),
    supabase
      .from("v_estado_mantencion")
      .select("plan_id, semaforo, proxima_fecha, dias_restantes, horas_restantes, disparador")
      .eq("activo_id", id),
    supabase
      .from("lecturas_uso")
      .select("id, fecha, horometro, kilometraje")
      .eq("activo_id", id)
      .order("fecha", { ascending: false })
      .limit(12),
    supabase
      .from("ordenes_mantencion")
      .select("id", { count: "exact", head: true })
      .eq("activo_id", id),
    listarTiposActivo(),
  ]);

  if (resActivo.error || !resActivo.data) {
    if (resActivo.error) console.error("No pude leer el activo:", resActivo.error.message);
    return { activo: null, tipo_nombre: null, planes: [], lecturas: [], ordenes: 0 };
  }

  const activo = resActivo.data as Activo;

  type FilaEstado = {
    plan_id: string;
    semaforo: Semaforo | null;
    proxima_fecha: string | null;
    dias_restantes: number | null;
    horas_restantes: number | null;
    disparador: "fecha" | "horas" | null;
  };

  const estadoPorPlan = new Map(
    ((resEstado.data ?? []) as FilaEstado[]).map((e) => [e.plan_id, e]),
  );

  const planes = ((resPlanes.data ?? []) as Omit<
    PlanDeActivo,
    "semaforo" | "proxima_fecha" | "dias_restantes" | "horas_restantes" | "disparador"
  >[]).map((p) => {
    const e = estadoPorPlan.get(p.id);
    return {
      ...p,
      semaforo: e?.semaforo ?? null,
      proxima_fecha: e?.proxima_fecha ?? null,
      dias_restantes: e?.dias_restantes ?? null,
      horas_restantes: e?.horas_restantes ?? null,
      disparador: e?.disparador ?? null,
    };
  });

  return {
    activo,
    tipo_nombre: tipos.find((t) => t.codigo === activo.tipo_codigo)?.nombre ?? null,
    planes,
    lecturas: (resLecturas.data ?? []) as LecturaUso[],
    ordenes: resOrdenes.count ?? 0,
  };
}
