import { crearClienteServidor } from "@/lib/supabase/server";
import { listarTiposActivo } from "@/lib/datos/activos";
import type { EstadoActivo, Semaforo, TipoMantencion } from "@/lib/tipos";

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

/* ────────────────────────────────────────────────────────────────────────────
   Gasto de mantención por máquina, para el resumen y su previsualización.
   ──────────────────────────────────────────────────────────────────────── */

export type PuntoMes = {
  /** Clave ordenable, formato AAAA-MM. */
  mes: string;
  /** Como se escribe en pantalla: "ene 26". */
  etiqueta: string;
  monto: number;
  acumulado: number;
};

export type GastoActivo = {
  activo_id: string;
  codigo_interno: string;
  nombre: string;
  tipo_nombre: string | null;
  estado: EstadoActivo;
  ubicacion: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  horometro_actual: number | null;
  kilometraje_actual: number | null;
  total: number;
  ordenes: number;
  preventiva: number;
  correctiva: number;
  ultima_fecha: string | null;
  serie: PuntoMes[];
};

export type PanelGasto = {
  total: number;
  ordenes: number;
  /** Ordenados de mayor a menor gasto. Los sin gasto quedan al final. */
  activos: GastoActivo[];
  /** Cuantos activos no tienen ninguna orden completada todavia. */
  sinGasto: number;
  error: string | null;
};

const MES_CORTO = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/*
  La etiqueta se arma con los componentes de la cadena y NO con new Date(iso).
  Una fecha sin hora se interpreta como UTC, y en Chile eso corre el dia hacia
  atras: una orden del 1 de marzo aparecería en febrero.
*/
function etiquetaMes(mes: string): string {
  const [anio, m] = mes.split("-");
  return `${MES_CORTO[Number(m) - 1]} ${anio.slice(2)}`;
}

/* Suma un mes a una clave AAAA-MM sin pasar por Date. */
function mesSiguiente(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return m === 12
    ? `${anio + 1}-01`
    : `${anio}-${String(m + 1).padStart(2, "0")}`;
}

/*
  Serie mensual con los huecos rellenos.

  Un mes sin gasto tiene que aparecer con cero y no desaparecer del eje. Si se
  omitiera, dos meses separados por un año de inactividad quedarían pegados y el
  gráfico contaría una historia falsa sobre el ritmo del gasto.
*/
function armaSerie(movimientos: { mes: string; monto: number }[], tope: number): PuntoMes[] {
  if (movimientos.length === 0) return [];

  const porMes = new Map<string, number>();
  for (const m of movimientos) porMes.set(m.mes, (porMes.get(m.mes) ?? 0) + m.monto);

  const claves = [...porMes.keys()].sort();
  const primero = claves[0];
  const ultimo = claves[claves.length - 1];

  const completos: string[] = [];
  for (let cursor = primero; ; cursor = mesSiguiente(cursor)) {
    completos.push(cursor);
    if (cursor === ultimo) break;
    // Cinturon de seguridad: una fecha corrupta no puede colgar el servidor.
    if (completos.length > 600) break;
  }

  /*
    El corte se hace por la cola y el acumulado se calcula ANTES de cortar: si
    se calculara después, el acumulado del primer mes visible partiría en cero y
    diría que la máquina no había gastado nada antes, que es falso.
  */
  let acumulado = 0;
  const serie = completos.map((mes) => {
    acumulado += porMes.get(mes) ?? 0;
    return { mes, etiqueta: etiquetaMes(mes), monto: porMes.get(mes) ?? 0, acumulado };
  });

  return serie.slice(-tope);
}

type OrdenGasto = {
  activo_id: string | null;
  tipo: TipoMantencion;
  costo_total: number | null;
  fecha_ejecucion: string | null;
};

type ActivoGasto = {
  id: string;
  nombre: string;
  codigo_interno: string;
  tipo_codigo: string;
  estado: EstadoActivo;
  ubicacion: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  horometro_actual: number | null;
  kilometraje_actual: number | null;
};

/*
  Un viaje por los activos y otro por las órdenes, y el cruce en memoria. Pedir
  las órdenes anidadas dentro de cada activo traería la lista completa de campos
  de la orden por cada fila, y de esto solo se necesitan cuatro columnas.

  Límite conocido: 5000 órdenes completadas, igual que cargarReportes. Con una
  flota agrícola son varios años. Cuando se pase, esto se convierte en una vista
  agregada por mes en la base.
*/
export async function cargarPanelGasto(mesesVisibles = 24): Promise<PanelGasto> {
  const supabase = await crearClienteServidor();

  const [resActivos, resOrdenes, tipos] = await Promise.all([
    supabase
      .from("activos")
      .select(
        "id, nombre, codigo_interno, tipo_codigo, estado, ubicacion, marca, modelo, anio, horometro_actual, kilometraje_actual",
      )
      .order("codigo_interno"),
    supabase
      .from("ordenes_mantencion")
      .select("activo_id, tipo, costo_total, fecha_ejecucion")
      .eq("estado", "completada")
      .not("fecha_ejecucion", "is", null)
      .limit(5000),
    listarTiposActivo(),
  ]);

  const vacio: PanelGasto = { total: 0, ordenes: 0, activos: [], sinGasto: 0, error: null };

  const error = resActivos.error?.message ?? resOrdenes.error?.message ?? null;
  if (error) {
    console.error("No pude leer el gasto de la flota:", error);
    return { ...vacio, error };
  }

  const activos = (resActivos.data ?? []) as ActivoGasto[];
  const ordenes = (resOrdenes.data ?? []) as OrdenGasto[];
  const nombreTipo = new Map(tipos.map((t) => [t.codigo, t.nombre]));

  const porActivo = new Map<
    string,
    { total: number; ordenes: number; preventiva: number; correctiva: number; ultima: string | null; movimientos: { mes: string; monto: number }[] }
  >();

  for (const o of ordenes) {
    if (!o.activo_id || !o.fecha_ejecucion) continue;
    const monto = Number(o.costo_total ?? 0);
    const actual =
      porActivo.get(o.activo_id) ??
      { total: 0, ordenes: 0, preventiva: 0, correctiva: 0, ultima: null, movimientos: [] };

    actual.total += monto;
    actual.ordenes += 1;
    if (o.tipo === "preventiva") actual.preventiva += monto;
    if (o.tipo === "correctiva") actual.correctiva += monto;
    if (!actual.ultima || o.fecha_ejecucion > actual.ultima) actual.ultima = o.fecha_ejecucion;
    actual.movimientos.push({ mes: o.fecha_ejecucion.slice(0, 7), monto });

    porActivo.set(o.activo_id, actual);
  }

  const filas: GastoActivo[] = activos.map((a) => {
    const g = porActivo.get(a.id);
    return {
      activo_id: a.id,
      codigo_interno: a.codigo_interno,
      nombre: a.nombre,
      tipo_nombre: nombreTipo.get(a.tipo_codigo) ?? null,
      estado: a.estado,
      ubicacion: a.ubicacion,
      marca: a.marca,
      modelo: a.modelo,
      anio: a.anio,
      horometro_actual: a.horometro_actual,
      kilometraje_actual: a.kilometraje_actual,
      total: g?.total ?? 0,
      ordenes: g?.ordenes ?? 0,
      preventiva: g?.preventiva ?? 0,
      correctiva: g?.correctiva ?? 0,
      ultima_fecha: g?.ultima ?? null,
      serie: armaSerie(g?.movimientos ?? [], mesesVisibles),
    };
  });

  filas.sort((a, b) => b.total - a.total || a.codigo_interno.localeCompare(b.codigo_interno, "es"));

  return {
    total: filas.reduce((s, f) => s + f.total, 0),
    ordenes: filas.reduce((s, f) => s + f.ordenes, 0),
    activos: filas,
    sinGasto: filas.filter((f) => f.ordenes === 0).length,
    error: null,
  };
}
