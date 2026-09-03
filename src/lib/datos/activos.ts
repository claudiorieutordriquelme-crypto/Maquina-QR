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
  /*
    Planes que CALCULAN SEMAFORO. Sale de v_estado_mantencion, que deja fuera
    los planes desactivados y los activos dados de baja. Es el numero correcto
    para hablar del semaforo y el EQUIVOCADO para hablar de un borrado.
  */
  planes: number;
  /*
    TODOS los planes de la maquina, incluidos los desactivados. Este es el que
    se va en cascada al borrar el activo, y por eso es el que tiene que aparecer
    en la confirmacion. Antes se usaba el de arriba, y una maquina dada de baja
    con tres planes desactivados decia "se van 0 planes" y se llevaba tres.
  */
  planesTotales: number;
  /** Mantenciones registradas, de cualquier estado. */
  ordenes: number;
  /*
    false cuando el conteo de ordenes no se pudo establecer con certeza, sea
    porque la consulta fallo o porque se topo con el limite de filas. Con esto
    en false la interfaz NO puede ofrecer el borrado: afirmar "esta maquina no
    tiene historial" sin haber podido contar es exactamente la mentira que
    provoca una perdida de datos.
  */
  conteoOrdenesFiable: boolean;
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

  const [resActivos, resEstados, resPlanes, resOrdenes, resTipos] = await Promise.all([
    supabase.from("activos").select("*").order("codigo_interno"),
    supabase.from("v_estado_mantencion").select("activo_id, semaforo"),
    /*
      Los planes se cuentan de su propia tabla y NO de la vista del semaforo.
      La vista deja fuera los planes desactivados y las maquinas dadas de baja,
      y ese numero es el que se le muestra a alguien antes de borrar en cascada.
    */
    supabase.from("planes_mantencion").select("activo_id").limit(20000),
    /*
      Una columna por orden, para contarlas por maquina: el cliente de Supabase
      no expone GROUP BY, asi que un count por activo serian tantas consultas
      como activos. Se pide count exacto ademas de las filas, para poder
      DETECTAR si el lote vino cortado.
    */
    supabase.from("ordenes_mantencion").select("activo_id", { count: "exact" }).limit(20000),
    listarTiposActivo(),
  ]);

  const error = resActivos.error?.message ?? resEstados.error?.message ?? null;
  if (error) return { activos: [], ubicaciones: [], error };

  /*
    Un fallo al contar ordenes NO tumba el listado, pero TAMPOCO se cuenta cero
    en silencio. Antes se hacia eso, y el efecto era que un error de lectura
    hacia aparecer el boton de borrar en toda la flota, incluidas las maquinas
    con historial. La base habria rechazado el borrado, pero la interfaz ya
    habria afirmado que esas maquinas no tienen mantenciones.

    Lo mismo con el corte por limite de filas: si el count exacto no coincide
    con las filas recibidas, el lote vino incompleto y hay maquinas cuyo
    historial no se vio.
  */
  const filasOrdenes = (resOrdenes.data ?? []) as { activo_id: string | null }[];
  const totalOrdenes = resOrdenes.count ?? null;
  const conteoOrdenesFiable =
    !resOrdenes.error && (totalOrdenes === null || totalOrdenes === filasOrdenes.length);

  if (resOrdenes.error) {
    console.error("No pude contar las mantenciones por activo:", resOrdenes.error.message);
  } else if (!conteoOrdenesFiable) {
    console.error(
      `El conteo de mantenciones vino cortado: ${filasOrdenes.length} de ${totalOrdenes}. El borrado de activos queda deshabilitado hasta que esto se agregue en la base.`,
    );
  }

  const ordenesPorActivo = new Map<string, number>();
  for (const o of filasOrdenes) {
    if (!o.activo_id) continue;
    ordenesPorActivo.set(o.activo_id, (ordenesPorActivo.get(o.activo_id) ?? 0) + 1);
  }

  /*
    Los planes tambien pueden venir cortados. Si eso pasa, se cuenta lo que hay
    y se marca el conteo de ordenes como no fiable, que es lo que apaga el
    borrado: preferible no ofrecerlo que ofrecerlo con un numero inventado.
  */
  const planesPorActivo = new Map<string, number>();
  if (resPlanes.error) {
    console.error("No pude contar los planes por activo:", resPlanes.error.message);
  } else {
    for (const p of (resPlanes.data ?? []) as { activo_id: string | null }[]) {
      if (!p.activo_id) continue;
      planesPorActivo.set(p.activo_id, (planesPorActivo.get(p.activo_id) ?? 0) + 1);
    }
  }
  const planesFiable = !resPlanes.error;

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
    planesTotales: planesPorActivo.get(a.id) ?? 0,
    ordenes: ordenesPorActivo.get(a.id) ?? 0,
    conteoOrdenesFiable: conteoOrdenesFiable && planesFiable,
  }));

  const ubicaciones = [...new Set(activos.map((a) => a.ubicacion).filter((u): u is string => !!u))].sort();

  if (filtros.tipo) activos = activos.filter((a) => a.tipo_codigo === filtros.tipo);
  if (filtros.estado) activos = activos.filter((a) => a.estado === filtros.estado);
  if (filtros.ubicacion) activos = activos.filter((a) => a.ubicacion === filtros.ubicacion);
  /*
    "sin_planes" no es un valor del enum semaforo_mantencion: es la ausencia de
    filas en la vista para ese activo. Se trata aparte porque es justamente el
    caso mas riesgoso, una maquina sin ningun plan que calcular, y antes era el
    unico que no se podia aislar.
  */
  if (filtros.semaforo === "sin_planes") {
    activos = activos.filter((a) => a.semaforo === null);
  } else if (filtros.semaforo) {
    activos = activos.filter((a) => a.semaforo === filtros.semaforo);
  }

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
  /** Las mas recientes, para mostrar. Topadas a 12. */
  lecturas: LecturaUso[];
  /*
    Cuantas lecturas hay EN TOTAL. La lista de arriba viene topada a 12, y con
    ese largo se estaba escribiendo la advertencia del borrado: una maquina con
    60 lecturas avisaba que se iban 12 y se llevaba 60.
  */
  lecturasTotales: number;
  ordenes: number;
}> {
  const supabase = await crearClienteServidor();

  const [resActivo, resPlanes, resEstado, resLecturas, resOrdenes, resLecturasTotal, tipos] =
    await Promise.all([
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
    /* Conteo aparte, exacto y sin traer filas: la lista de arriba esta topada. */
    supabase
      .from("lecturas_uso")
      .select("id", { count: "exact", head: true })
      .eq("activo_id", id),
    listarTiposActivo(),
  ]);

  if (resActivo.error || !resActivo.data) {
    if (resActivo.error) console.error("No pude leer el activo:", resActivo.error.message);
    return {
      activo: null,
      tipo_nombre: null,
      planes: [],
      lecturas: [],
      lecturasTotales: 0,
      ordenes: 0,
    };
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
    lecturasTotales: resLecturasTotal.count ?? 0,
    ordenes: resOrdenes.count ?? 0,
  };
}
