/*
  Contrato de datos de la superficie publica.

  Estos tipos describen exactamente el JSON que devuelve
  public.get_ficha_publica(uuid, text). No son un modelo del dominio completo:
  son el subconjunto que la base decide exponer sin login.

  Los campos marcados como opcionales (proveedor, numero_factura, costo_total,
  subtotal) llegan solo cuando configuracion.mostrar_costos_publico = true. El
  filtro ocurre en la base, no aca: si estuviera en el componente, los montos
  igual viajarian en la respuesta de red y bastaria abrir las herramientas de
  desarrollo para verlos.
*/

export type Semaforo = "vencida" | "critica" | "proxima" | "al_dia" | "sin_linea_base";

export type Disparador = "fecha" | "horas";

export type TipoMantencion = "preventiva" | "correctiva" | "predictiva";

export type EstadoActivo = "operativo" | "en_mantencion" | "fuera_servicio" | "dado_de_baja";

export type EstadoMantencion = {
  plan: string;
  /** Fecha ISO. Cuando el disparador es por horas, es una estimacion. */
  proxima_fecha: string | null;
  semaforo: Semaforo;
  /** El menor entre el plazo por calendario y el plazo por horas proyectado. */
  dias_restantes: number | null;
  disparador: Disparador | null;
  /** Negativo o cero significa que el horometro ya paso el umbral. */
  horas_restantes: number | null;
};

export type RepuestoHistorial = {
  descripcion: string | null;
  cantidad: number;
  unidad: string | null;
  subtotal?: number | null;
};

export type OrdenHistorial = {
  folio: number;
  fecha_ejecucion: string;
  tipo: TipoMantencion;
  descripcion_trabajo: string;
  causa_falla: string | null;
  horometro_ejecucion: number | null;
  /** Con costos ocultos llega "Servicio externo" o "Interno", nunca el nombre. */
  ejecutor: string | null;
  repuestos: RepuestoHistorial[];
  proveedor?: string | null;
  numero_factura?: string | null;
  costo_total?: number | null;
  monto_mano_obra?: number | null;
  monto_repuestos?: number | null;
  monto_otros?: number | null;
};

export type ActivoPublico = {
  nombre: string;
  codigo_interno: string;
  patente: string | null;
  tipo_codigo: string;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  ubicacion: string | null;
  estado: EstadoActivo;
  horometro_actual: number | null;
  kilometraje_actual: number | null;
  foto_path: string | null;
};

export type FichaPublica = {
  activo: ActivoPublico;
  estado_mantencion: EstadoMantencion[];
  historial: OrdenHistorial[];
  muestra_costos: boolean;
  generado_en: string;
};

/** La funcion devuelve esto en vez de la ficha cuando se excede el rate limit. */
export type RespuestaRateLimit = { error: "rate_limit" };

export type ResultadoFicha = FichaPublica | RespuestaRateLimit | null;

export function esRateLimit(r: ResultadoFicha): r is RespuestaRateLimit {
  return r !== null && "error" in r && r.error === "rate_limit";
}

export function esFicha(r: ResultadoFicha): r is FichaPublica {
  return r !== null && "activo" in r;
}
