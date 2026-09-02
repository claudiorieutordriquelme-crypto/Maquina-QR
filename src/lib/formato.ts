import type { EstadoMantencion, EstadoActivo, Semaforo, TipoMantencion } from "@/lib/tipos";

/*
  Formatos es-CL y presentacion del semaforo.

  Todo lo que decide como se lee un estado vive aca y no en el componente, para
  que la ficha publica (Etapa 4) y el dashboard (Etapa 9) no terminen diciendo
  cosas distintas del mismo dato.
*/

const FECHA_LARGA = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const FECHA_CORTA = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const NUMERO = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });

const PESOS = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

/*
  Postgres devuelve las columnas date como 'YYYY-MM-DD'. Pasarle eso a new Date()
  lo interpreta como medianoche UTC, y en Chile (UTC-4) eso se renderiza como el
  dia anterior. Se construye la fecha con los componentes locales para que el 2
  de septiembre se lea 2 de septiembre.
*/
function fechaLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formateaFecha(iso: string | null): string {
  if (!iso) return "Sin fecha";
  const d = fechaLocal(iso);
  return d ? FECHA_LARGA.format(d) : "Sin fecha";
}

export function formateaFechaCorta(iso: string | null): string {
  if (!iso) return "Sin fecha";
  const d = fechaLocal(iso);
  return d ? FECHA_CORTA.format(d) : "Sin fecha";
}

/** Para timestamptz, que si trae zona y no necesita el arreglo de arriba. */
export function formateaMomento(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "Sin fecha"
    : new Intl.DateTimeFormat("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
}

export function formateaNumero(n: number | null): string {
  return n === null || n === undefined ? "Sin dato" : NUMERO.format(n);
}

export function formateaHoras(n: number | null): string {
  return n === null || n === undefined ? "Sin dato" : `${NUMERO.format(n)} h`;
}

export function formateaPesos(n: number | null | undefined): string {
  return n === null || n === undefined ? "Sin dato" : PESOS.format(n);
}

export const ETIQUETA_SEMAFORO: Record<Semaforo, string> = {
  vencida: "Vencida",
  critica: "Crítica",
  proxima: "Próxima",
  al_dia: "Al día",
  sin_linea_base: "Sin datos",
};

export const ETIQUETA_ESTADO_ACTIVO: Record<EstadoActivo, string> = {
  operativo: "Operativo",
  en_mantencion: "En mantención",
  fuera_servicio: "Fuera de servicio",
  dado_de_baja: "Dado de baja",
};

export const ETIQUETA_TIPO_MANTENCION: Record<TipoMantencion, string> = {
  preventiva: "Preventiva",
  correctiva: "Correctiva",
  predictiva: "Predictiva",
};

/*
  Presentacion del semaforo. Cada estado lleva etiqueta de texto y un glifo de
  forma distinta, no solo color: en terreno hay daltonismo y pantallas quemadas
  por el sol, y ahi el color es lo primero que se pierde.

  Sobre los colores elegidos, con los contrastes medidos contra blanco:
  - El acento #c0341b da 5.8:1, asi que pasa AA para texto normal. Con el acento
    Entel anterior (#ff3d00, 3.5:1) esto no se podia: la insignia de vencida
    tenia que llevar texto negro para alcanzar contraste. Con el rojo tierra del
    cliente, blanco sobre acento queda en 5.8:1, que es legible y ademas la
    convencion que la gente espera de una alerta.
  - El secundario #8cc63f es un verde claro y como texto es ilegible: 2.1:1.
    Regla firme, color en la barra y el borde, texto en gris oscuro.
  - El primario #2e7d32 da 5.1:1, asi que si sirve para texto y no solo para
    bordes, que es lo que permite usarlo en enlaces.
*/
export type PresentacionSemaforo = {
  etiqueta: string;
  glifo: Semaforo;
  barra: string;
  insignia: string;
  /** Peso visual de la fila completa, para ordenar la lectura de un vistazo. */
  destaca: boolean;
};

export const PRESENTACION_SEMAFORO: Record<Semaforo, PresentacionSemaforo> = {
  vencida: {
    etiqueta: "Vencida",
    glifo: "vencida",
    barra: "bg-acento",
    insignia: "bg-acento text-blanco",
    destaca: true,
  },
  critica: {
    etiqueta: "Crítica",
    glifo: "critica",
    barra: "bg-acento",
    insignia: "border border-acento text-gris-900",
    destaca: true,
  },
  proxima: {
    etiqueta: "Próxima",
    glifo: "proxima",
    barra: "bg-gris-800",
    insignia: "border border-gris-800 text-gris-900",
    destaca: false,
  },
  al_dia: {
    etiqueta: "Al día",
    glifo: "al_dia",
    barra: "bg-secundario",
    insignia: "border border-secundario text-gris-900",
    destaca: false,
  },
  sin_linea_base: {
    etiqueta: "Sin datos",
    glifo: "sin_linea_base",
    barra: "bg-gris-300",
    insignia: "border border-gris-300 text-gris-500",
    destaca: false,
  },
};

/** True cuando el horometro ya paso el umbral del plan. */
export function vencidaPorHorometro(e: EstadoMantencion): boolean {
  return e.horas_restantes !== null && e.horas_restantes <= 0;
}

/*
  Un plan vencido por horometro llega con dias_restantes = 0, porque la vista
  acota la proyeccion en cero. Decirle "Vence hoy" a un operador cuya maquina ya
  paso el umbral contradice la etiqueta VENCIDA y lo hace dudar de la pantalla.
  En ese caso se informa el exceso de horas y se oculta la fecha estimada, que
  por construccion es hoy y no aporta nada.
*/
export function textoPlazo(e: EstadoMantencion): string {
  if (vencidaPorHorometro(e)) {
    const exceso = Math.abs(e.horas_restantes ?? 0);
    return exceso === 0
      ? "Alcanzó el umbral de horas de uso"
      : `Excedida en ${NUMERO.format(exceso)} h de uso`;
  }

  if (e.semaforo === "sin_linea_base" || e.dias_restantes === null) {
    return "Sin datos para calcular el vencimiento";
  }

  const d = e.dias_restantes;
  if (d < 0) {
    const dias = Math.abs(d);
    return dias === 1 ? "Venció ayer" : `Venció hace ${NUMERO.format(dias)} días`;
  }
  if (d === 0) return "Vence hoy";
  if (d === 1) return "Vence mañana";
  return `Vence en ${NUMERO.format(d)} días`;
}

export function muestraFechaEstimada(e: EstadoMantencion): boolean {
  if (vencidaPorHorometro(e)) return false;
  if (e.semaforo === "sin_linea_base") return false;
  return e.proxima_fecha !== null;
}

/*
  El plazo por horas es una proyeccion: convierte horas restantes a dias usando
  la tasa de uso observada. Se avisa cuando la fecha que se muestra sale de ahi,
  para que nadie la lea como un compromiso de calendario.
*/
export function esFechaProyectada(e: EstadoMantencion): boolean {
  return e.disparador === "horas" && !vencidaPorHorometro(e);
}

/** Texto de apoyo con las horas que faltan, cuando el plan las controla. */
export function textoHorasRestantes(e: EstadoMantencion): string | null {
  if (e.horas_restantes === null || e.horas_restantes <= 0) return null;
  return `Quedan ${NUMERO.format(e.horas_restantes)} h de uso`;
}
