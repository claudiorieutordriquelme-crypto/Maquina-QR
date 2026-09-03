import { SerieGasto } from "@/components/graficos/serie-gasto";
import { armaSerieMensual, mesDeFecha } from "@/lib/serie-mensual";
import type { EstadoMantencion, FichaPublica, OrdenHistorial, Semaforo } from "@/lib/tipos";
import {
  ETIQUETA_ESTADO_ACTIVO,
  ETIQUETA_TIPO_MANTENCION,
  PRESENTACION_SEMAFORO,
  esFechaProyectada,
  formateaFecha,
  formateaFechaCorta,
  formateaHoras,
  formateaMomento,
  formateaNumero,
  formateaPesos,
  muestraFechaEstimada,
  textoHorasRestantes,
  textoPlazo,
} from "@/lib/formato";

/*
  Presentacion de la ficha publica.

  Server Component puro, sin una linea de JavaScript de cliente. El historial
  colapsa con <details> nativo en vez de estado de React: mismo resultado, cero
  bundle. Esta pantalla se abre de pie en un galpon, con guantes, con sol encima
  y con senal mala, asi que cada kilobyte que no se manda es tiempo que el
  operador no espera.

  Orden de lectura, en este orden y por esta razon: identificacion grande
  arriba, estado de mantencion con su color inmediatamente despues, historial
  colapsado al final. Quien escanea casi siempre viene por lo segundo.
*/

/*
  Cada estado tiene un glifo de forma distinta, no una variante de color del
  mismo icono. El color es lo primero que se pierde con daltonismo o con una
  pantalla quemada por el sol, y ahi la forma es lo unico que queda. Van como
  SVG en linea, con fill currentColor, para heredar el color de la insignia sin
  cargar una libreria de iconos.
*/
function Glifo({ estado, className }: { estado: Semaforo; className?: string }) {
  const comun = {
    viewBox: "0 0 16 16",
    className: className ?? "size-4 shrink-0",
    "aria-hidden": true as const,
    fill: "currentColor",
  };

  switch (estado) {
    case "vencida":
      // Circulo lleno: la forma mas pesada de la escala.
      return (
        <svg {...comun}>
          <circle cx="8" cy="8" r="7" />
          <rect x="7" y="4" width="2" height="5" rx="1" fill="var(--color-blanco)" />
          <rect x="7" y="10.5" width="2" height="2" rx="1" fill="var(--color-blanco)" />
        </svg>
      );
    case "critica":
      // Triangulo: distinto contorno, misma familia de urgencia.
      return (
        <svg {...comun}>
          <path d="M8 1.2 15.2 14H0.8L8 1.2Z" />
          <rect x="7" y="5.5" width="2" height="4.5" rx="1" fill="var(--color-blanco)" />
          <rect x="7" y="11" width="2" height="1.8" rx="0.9" fill="var(--color-blanco)" />
        </svg>
      );
    case "proxima":
      // Reloj: la unica forma con manecillas, se distingue en miniatura.
      return (
        <svg {...comun}>
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 8 3Z" />
          <path d="M7.25 4.5h1.5v4H7.25V4.5Zm0 2.75h4v1.5h-4v-1.5Z" />
        </svg>
      );
    case "al_dia":
      // Ticket: forma abierta, sin contorno cerrado, opuesta a las de alerta.
      return (
        <svg {...comun}>
          <path d="M6.2 12.6 1.8 8.2l1.6-1.6 2.8 2.8 6.4-6.4 1.6 1.6-8 8Z" />
        </svg>
      );
    default:
      // Guion en marco punteado: dice "no hay dato", no "esta bien".
      return (
        <svg {...comun}>
          <path d="M2 2h4v1.6H3.6V6H2V2Zm8 0h4v4h-1.6V3.6H10V2ZM2 10h1.6v2.4H6V14H2v-4Zm10.4 0H14v4h-4v-1.6h2.4V10Z" />
          <rect x="4.5" y="7.2" width="7" height="1.6" rx="0.8" />
        </svg>
      );
  }
}

function DatoActivo({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gris-500">{termino}</dt>
      <dd className="mt-0.5 text-base font-medium text-gris-900">{valor}</dd>
    </div>
  );
}

function FilaEstado({ estado }: { estado: EstadoMantencion }) {
  const p = PRESENTACION_SEMAFORO[estado.semaforo];
  const horas = textoHorasRestantes(estado);

  return (
    <li className="flex overflow-hidden rounded-lg border border-gris-200 bg-blanco">
      {/* La barra de color es refuerzo, nunca el unico portador del estado. */}
      <div className={`w-2 shrink-0 ${p.barra}`} aria-hidden="true" />

      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-base font-semibold text-gris-900">{estado.plan}</h3>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs font-bold uppercase tracking-wide ${p.insignia}`}
          >
            <Glifo estado={estado.semaforo} className="size-3.5 shrink-0" />
            {p.etiqueta}
          </span>
        </div>

        <p
          className={`mt-2 text-lg leading-snug ${
            p.destaca ? "font-bold text-gris-900" : "font-semibold text-gris-800"
          }`}
        >
          {textoPlazo(estado)}
        </p>

        {muestraFechaEstimada(estado) ? (
          <p className="mt-1 text-sm text-gris-600">
            {esFechaProyectada(estado) ? "Fecha estimada por uso: " : "Fecha: "}
            {formateaFecha(estado.proxima_fecha)}
          </p>
        ) : null}

        {horas ? <p className="mt-1 text-sm text-gris-600">{horas}</p> : null}
      </div>
    </li>
  );
}

function OrdenHistorialItem({ orden, muestraCostos }: { orden: OrdenHistorial; muestraCostos: boolean }) {
  return (
    <li className="border-t border-gris-100 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-base font-bold text-gris-900">{formateaFechaCorta(orden.fecha_ejecucion)}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-gris-500">
          {ETIQUETA_TIPO_MANTENCION[orden.tipo]}
          {" · Folio "}
          {orden.folio}
        </p>
      </div>

      <p className="mt-1.5 text-base leading-snug text-gris-800">{orden.descripcion_trabajo}</p>

      {orden.causa_falla ? (
        <p className="mt-1 text-sm text-gris-600">
          <span className="font-semibold">Causa: </span>
          {orden.causa_falla}
        </p>
      ) : null}

      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gris-600">
        {orden.ejecutor ? (
          <div className="flex gap-1">
            <dt className="font-semibold">Ejecutó:</dt>
            <dd>{orden.ejecutor}</dd>
          </div>
        ) : null}
        {orden.horometro_ejecucion !== null ? (
          <div className="flex gap-1">
            <dt className="font-semibold">Horómetro:</dt>
            <dd>{formateaHoras(orden.horometro_ejecucion)}</dd>
          </div>
        ) : null}
        {muestraCostos && orden.numero_factura ? (
          <div className="flex gap-1">
            <dt className="font-semibold">Factura:</dt>
            <dd>{orden.numero_factura}</dd>
          </div>
        ) : null}
      </dl>

      {orden.repuestos.length > 0 ? (
        <ul className="mt-2 space-y-1 border-l-2 border-gris-200 pl-3">
          {orden.repuestos.map((r, i) => (
            <li key={`${orden.folio}-r${i}`} className="text-sm text-gris-700">
              <span className="font-medium">{formateaNumero(r.cantidad)}</span>
              {r.unidad ? ` ${r.unidad}` : ""}
              {" · "}
              {r.descripcion ?? "Repuesto sin descripción"}
              {muestraCostos && r.subtotal !== null && r.subtotal !== undefined
                ? ` · ${formateaPesos(r.subtotal)}`
                : ""}
            </li>
          ))}
        </ul>
      ) : null}

      {muestraCostos && orden.costo_total !== null && orden.costo_total !== undefined ? (
        <p className="mt-2 text-base font-bold text-gris-900">
          Costo total: {formateaPesos(orden.costo_total)}
        </p>
      ) : null}
    </li>
  );
}

export function FichaPublicaVista({ ficha, token }: { ficha: FichaPublica; token: string }) {
  const { activo, estado_mantencion, historial, muestra_costos } = ficha;

  /*
    Serie de gasto armada desde el historial que la base ya mando, sin ninguna
    consulta extra. Con los costos ocultos, costo_total simplemente no viene y
    conCosto queda vacio: el filtro es de la base y aca no hay nada que decidir.

    El calculo es sobre lo que hay EN ESTA FICHA. El historial publico esta
    acotado por parametros_calculo.historial_publico_limite, asi que una maquina
    con mucha vida puede tener gasto anterior que no aparece. El grafico lo dice
    en su advertencia en vez de presentar un acumulado parcial como si fuera el
    total de la maquina.
  */
  const conCosto = muestra_costos
    ? historial.filter(
        (o) => o.costo_total !== null && o.costo_total !== undefined && o.fecha_ejecucion,
      )
    : [];
  const totalHistorial = conCosto.reduce((s, o) => s + Number(o.costo_total ?? 0), 0);
  const serie = armaSerieMensual(
    conCosto
      .map((o) => ({ mes: mesDeFecha(o.fecha_ejecucion), monto: Number(o.costo_total ?? 0) }))
      .filter((m): m is { mes: string; monto: number } => m.mes !== null),
    24,
  );

  const identificacion = [activo.codigo_interno, activo.patente].filter(Boolean).join(" · ");
  const fabricacion = [activo.marca, activo.modelo, activo.anio ? String(activo.anio) : null]
    .filter(Boolean)
    .join(" ");

  return (
    <article className="mx-auto max-w-2xl bg-blanco pb-10">
      <header className="border-b-4 border-primario px-5 pt-7 pb-6">
        {activo.tipo ? (
          <p className="text-xs font-bold uppercase tracking-widest text-primario">{activo.tipo}</p>
        ) : null}

        <h1 className="mt-1 text-3xl leading-tight font-bold text-gris-900 sm:text-4xl">
          {activo.nombre}
        </h1>

        {identificacion ? (
          <p className="mt-2 text-lg font-semibold text-gris-700">{identificacion}</p>
        ) : null}

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
          <DatoActivo termino="Estado" valor={ETIQUETA_ESTADO_ACTIVO[activo.estado]} />
          {activo.ubicacion ? <DatoActivo termino="Ubicación" valor={activo.ubicacion} /> : null}
          {activo.horometro_actual !== null ? (
            <DatoActivo termino="Horómetro" valor={formateaHoras(activo.horometro_actual)} />
          ) : null}
          {activo.kilometraje_actual !== null ? (
            <DatoActivo
              termino="Kilometraje"
              valor={`${formateaNumero(activo.kilometraje_actual)} km`}
            />
          ) : null}
          {fabricacion ? <DatoActivo termino="Marca y modelo" valor={fabricacion} /> : null}
        </dl>
      </header>

      <section className="px-5 pt-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gris-500">
          Estado de mantención
        </h2>

        {estado_mantencion.length === 0 ? (
          <p className="mt-3 rounded-lg border border-gris-200 p-4 text-base text-gris-600">
            Este activo no tiene planes de mantención definidos.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {estado_mantencion.map((e, i) => (
              <FilaEstado key={`${e.plan}-${i}`} estado={e} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        {historial.length === 0 ? (
          <div className="border-t border-gris-200 px-5 py-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gris-500">
              Historial de mantenciones
            </h2>
            <p className="mt-2 text-base text-gris-600">
              Todavía no hay mantenciones registradas para este activo.
            </p>
          </div>
        ) : (
          <details className="border-t border-gris-200">
            <summary className="cursor-pointer px-5 py-5 text-sm font-bold uppercase tracking-widest text-gris-500 marker:text-primario">
              Historial de mantenciones
              <span className="ml-2 text-gris-400 normal-case">
                ({historial.length} {historial.length === 1 ? "registro" : "registros"})
              </span>
            </summary>
            <ul>
              {historial.map((o) => (
                <OrdenHistorialItem key={o.folio} orden={o} muestraCostos={muestra_costos} />
              ))}
            </ul>
          </details>
        )}
      </section>

      {/*
        Gasto de mantencion. SOLO aparece cuando la base dice muestra_costos, o
        sea cuando alguien encendio a proposito el interruptor de costos
        publicos en Configuracion.

        Esto NO amplia lo que la ficha publica: cuando ese interruptor esta
        encendido, cada orden del historial de mas abajo ya trae su costo total
        impreso. Este bloque agrega una lectura de esos mismos numeros, no un
        dato nuevo. Y con el interruptor apagado, get_ficha_publica ni siquiera
        manda los montos, asi que aca no hay nada que ocultar en el frontend: el
        filtro ocurre en la base, que es donde corresponde.
      */}
      {muestra_costos && serie.puntos.length > 0 ? (
        <section className="mt-8 border-t border-gris-200 px-5 pt-5">
          <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
            Gasto de mantención
          </h2>

          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gris-200 p-4">
              <dt className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                Total en esta ficha
              </dt>
              <dd className="mt-0.5 text-xl font-bold text-gris-900">
                {formateaPesos(totalHistorial)}
              </dd>
            </div>
            <div className="rounded-lg border border-gris-200 p-4">
              <dt className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                Mantenciones
              </dt>
              <dd className="mt-0.5 text-xl font-bold text-gris-900">{conCosto.length}</dd>
            </div>
          </dl>

          <div className="mt-5">
            <SerieGasto
              puntos={serie.puntos}
              mesesRecortados={serie.recortados}
              advertencia="Calculado sobre las mantenciones que aparecen en esta ficha, que muestra las más recientes. Si la máquina tiene historial más antiguo, no está sumado acá."
            />
          </div>
        </section>
      ) : null}

      {/*
        Puente a la ficha privada. El enlace no revela nada: el token ya viene en
        la direccion que esta persona esta mirando. Del otro lado hay sesion, y
        quien no la tenga aterriza en el login.
      */}
      <section className="mt-8 border-t border-gris-200 px-5 pt-5">
        <a
          href={`/admin/qr/${token}`}
          className="inline-flex items-center gap-2 rounded-lg border border-gris-300 px-4 py-3 text-sm font-semibold text-gris-800 transition-colors hover:border-primario hover:text-primario"
        >
          <svg viewBox="0 0 20 20" className="size-4 shrink-0 fill-current" aria-hidden="true">
            <path d="M10 3a7 7 0 0 1 6.3 4 7 7 0 0 1-12.6 0A7 7 0 0 1 10 3zm0 2a5 5 0 0 0-4.2 2.4A5 5 0 0 0 10 9.8a5 5 0 0 0 4.2-2.4A5 5 0 0 0 10 5z" />
            <path d="M3 12h2v3h3v2H4a1 1 0 0 1-1-1v-4zM15 12h2v4a1 1 0 0 1-1 1h-4v-2h3v-3z" />
          </svg>
          Ver el detalle completo
        </a>
        <p className="mt-2 text-xs text-gris-500">
          Para quienes trabajan acá. Pide iniciar sesión y abre la ficha interna
          de esta misma máquina, con su gasto y su historial completo.
        </p>
      </section>

      <footer className="mt-8 border-t border-gris-200 px-5 pt-5 text-xs text-gris-500">
        <p>Ficha generada el {formateaMomento(ficha.generado_en)}.</p>
        <p className="mt-1">Máquina QR · trazabilidad de mantención</p>
      </footer>
    </article>
  );
}
