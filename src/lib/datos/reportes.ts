import { crearClienteServidor } from "@/lib/supabase/server";
import type { Semaforo, TipoMantencion } from "@/lib/tipos";

/*
  Consultas del dashboard y los reportes.

  Todo pasa por el cliente con sesion, asi que cada agregado se calcula sobre lo
  que RLS permite leer a quien mira. Un total que incluyera filas que la persona
  no puede ver seria una filtracion por la puerta de atras.

  Las agregaciones se hacen en memoria y no en SQL porque el cliente de Supabase
  no expone GROUP BY, y crear vistas nuevas para cada reporte significaria una
  migracion por cada corte que alguien pida. Con el volumen de una flota
  agricola (decenas de activos, cientos de ordenes al ano) esto es irrelevante.
  El limite esta anotado en cada funcion: cuando se pase, el corte se convierte
  en una vista.
*/

export type FilaCriticidad = {
  plan_id: string;
  activo_id: string;
  activo_nombre: string;
  codigo_interno: string;
  plan_nombre: string;
  semaforo: Semaforo;
  dias_restantes: number | null;
  horas_restantes: number | null;
  proxima_fecha: string | null;
  disparador: "fecha" | "horas" | null;
};

export type Periodo = { desde?: string; hasta?: string };

/*
  Orden de criticidad. Vencida primero, y dentro de cada grupo por dias
  restantes: lo que vence antes va arriba. Es el orden en que un jefe de
  mantencion recorre la lista, y por eso se hace aca y no se deja al azar.
*/
const PESO: Record<Semaforo, number> = {
  vencida: 1,
  critica: 2,
  proxima: 3,
  al_dia: 4,
  sin_linea_base: 5,
};

export async function listarPorCriticidad(): Promise<{
  filas: FilaCriticidad[];
  error: string | null;
}> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("v_estado_mantencion")
    .select(
      "plan_id, activo_id, activo_nombre, codigo_interno, plan_nombre, semaforo, dias_restantes, horas_restantes, proxima_fecha, disparador",
    );

  if (error) return { filas: [], error: error.message };

  const filas = ((data ?? []) as FilaCriticidad[])
    .filter((f) => f.semaforo)
    .sort((a, b) => {
      const p = PESO[a.semaforo] - PESO[b.semaforo];
      if (p !== 0) return p;
      const da = a.dias_restantes ?? Number.MAX_SAFE_INTEGER;
      const db = b.dias_restantes ?? Number.MAX_SAFE_INTEGER;
      return da - db;
    });

  return { filas, error: null };
}

/*
  PostgREST devuelve un OBJETO cuando la relacion es muchos-a-uno, pero el
  cliente sin tipos generados la infiere como arreglo. En vez de forzar el
  casteo y confiar en una de las dos formas, se aceptan las dos y se normaliza
  con uno(). Si algun dia se generan los tipos de la base, esto sigue
  funcionando sin tocarlo.
*/
type Anidado<T> = T | T[] | null;

function uno<T>(v: Anidado<T> | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

type OrdenAgregable = {
  tipo: TipoMantencion;
  costo_total: number | null;
  fecha_ejecucion: string | null;
  proveedor_id: string | null;
  activos: Anidado<{ nombre: string; codigo_interno: string }>;
  proveedores: Anidado<{ nombre: string }>;
};

export type CorteCosto = {
  clave: string;
  etiqueta: string;
  ordenes: number;
  costo: number;
};

export type Reportes = {
  /** Solo ordenes completadas: una programada todavia no costo nada. */
  totalOrdenes: number;
  totalCosto: number;
  porActivo: CorteCosto[];
  porTipo: CorteCosto[];
  porProveedor: CorteCosto[];
  error: string | null;
};

/*
  Un solo viaje a la base para los tres cortes. Pedir tres veces las mismas
  filas para agrupar distinto seria triplicar el trafico por nada.

  Limite conocido: trae hasta 5000 ordenes completadas. Con una flota agricola
  eso son varios anos de historial. Cuando se pase, hay que mover los cortes a
  vistas agregadas en la base.
*/
export async function cargarReportes(periodo: Periodo = {}): Promise<Reportes> {
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("ordenes_mantencion")
    .select("tipo, costo_total, fecha_ejecucion, proveedor_id, activos(nombre, codigo_interno), proveedores(nombre)")
    .eq("estado", "completada")
    .not("fecha_ejecucion", "is", null)
    .limit(5000);

  if (periodo.desde) consulta = consulta.gte("fecha_ejecucion", periodo.desde);
  if (periodo.hasta) consulta = consulta.lte("fecha_ejecucion", periodo.hasta);

  const { data, error } = await consulta;

  const vacio: Reportes = {
    totalOrdenes: 0,
    totalCosto: 0,
    porActivo: [],
    porTipo: [],
    porProveedor: [],
    error: null,
  };

  if (error) return { ...vacio, error: error.message };

  const ordenes = (data ?? []) as unknown as OrdenAgregable[];

  const acumular = (
    filas: OrdenAgregable[],
    clave: (o: OrdenAgregable) => { clave: string; etiqueta: string },
  ): CorteCosto[] => {
    const mapa = new Map<string, CorteCosto>();
    for (const o of filas) {
      const { clave: k, etiqueta } = clave(o);
      const previo = mapa.get(k) ?? { clave: k, etiqueta, ordenes: 0, costo: 0 };
      previo.ordenes += 1;
      previo.costo += Number(o.costo_total ?? 0);
      mapa.set(k, previo);
    }
    return [...mapa.values()].sort((a, b) => b.costo - a.costo);
  };

  const ETIQUETA_TIPO: Record<TipoMantencion, string> = {
    preventiva: "Preventiva",
    correctiva: "Correctiva",
    predictiva: "Predictiva",
  };

  return {
    totalOrdenes: ordenes.length,
    totalCosto: ordenes.reduce((s, o) => s + Number(o.costo_total ?? 0), 0),
    porActivo: acumular(ordenes, (o) => {
      const a = uno(o.activos);
      return {
        clave: a?.codigo_interno ?? "(sin activo)",
        etiqueta: a ? `${a.codigo_interno} · ${a.nombre}` : "(activo eliminado)",
      };
    }),
    /*
      El tipo se ordena por un orden fijo y NO por costo, a diferencia de los
      otros dos cortes. La razon es de color: preventiva siempre lleva la misma
      tinta que correctiva, y si el orden cambiara segun el periodo filtrado,
      los colores se repintarian al filtrar. Un lector que aprendio "correctiva
      es el verde claro" quedaria enganado.
    */
    porTipo: acumular(ordenes, (o) => ({
      clave: o.tipo,
      etiqueta: ETIQUETA_TIPO[o.tipo] ?? o.tipo,
    })).sort((a, b) => {
      const orden: string[] = ["preventiva", "correctiva", "predictiva"];
      return orden.indexOf(a.clave) - orden.indexOf(b.clave);
    }),
    porProveedor: acumular(ordenes, (o) => ({
      clave: o.proveedor_id ?? "interno",
      etiqueta: uno(o.proveedores)?.nombre ?? "Trabajo interno",
    })),
    error: null,
  };
}
