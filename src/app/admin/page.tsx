import { DESCRIPCION_ROL, ETIQUETA_ROL, perfilHabilitado } from "@/lib/auth";
import { PRESENTACION_SEMAFORO } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Semaforo } from "@/lib/tipos";

/*
  Resumen del panel.

  Los conteos dependen de CURRENT_DATE y del horometro del momento, igual que la
  ficha publica, asi que no se cachea. Un resumen cacheado que dice "0 vencidas"
  cuando hay tres es peor que no tener resumen.
*/
export const dynamic = "force-dynamic";

const ORDEN_SEMAFORO: Semaforo[] = ["vencida", "critica", "proxima", "al_dia"];

type Conteos = {
  porSemaforo: Record<Semaforo, number>;
  totalPlanes: number;
  fueraServicio: number;
  bajoStock: number;
  error: string | null;
};

async function cargarConteos(): Promise<Conteos> {
  const supabase = await crearClienteServidor();
  const vacio: Record<Semaforo, number> = {
    vencida: 0,
    critica: 0,
    proxima: 0,
    al_dia: 0,
    sin_linea_base: 0,
  };

  /*
    Las tres consultas van en paralelo porque son independientes. Se leen a
    traves de RLS con el JWT de la sesion: si esto devuelve datos, la cadena
    completa de sesion, cookie, politica y vista esta funcionando.

    v_estado_mantencion tiene security_invoker=on, o sea aplica el RLS de quien
    consulta y no el del dueno de la vista. Sin esa opcion, una vista se
    convierte en una puerta lateral que evita las politicas de sus tablas.
  */
  const [estados, activos, repuestos] = await Promise.all([
    supabase.from("v_estado_mantencion").select("semaforo"),
    supabase.from("activos").select("id", { count: "exact", head: true }).eq("estado", "fuera_servicio"),
    supabase.from("repuestos").select("stock_actual, stock_minimo").eq("activo", true),
  ]);

  const error = estados.error?.message ?? activos.error?.message ?? repuestos.error?.message ?? null;
  if (error) return { porSemaforo: vacio, totalPlanes: 0, fueraServicio: 0, bajoStock: 0, error };

  const porSemaforo = { ...vacio };
  for (const fila of (estados.data ?? []) as { semaforo: Semaforo | null }[]) {
    if (fila.semaforo && fila.semaforo in porSemaforo) porSemaforo[fila.semaforo] += 1;
  }

  /*
    El filtro de stock minimo se hace aca y no en la consulta porque compara dos
    columnas entre si, y el cliente de Supabase solo compara una columna contra
    un valor. Con este volumen de repuestos da lo mismo; si el maestro crece,
    esto se convierte en una vista.
  */
  const bajoStock = ((repuestos.data ?? []) as { stock_actual: number; stock_minimo: number }[]).filter(
    (r) => Number(r.stock_actual) < Number(r.stock_minimo),
  ).length;

  return {
    porSemaforo,
    totalPlanes: (estados.data ?? []).length,
    fueraServicio: activos.count ?? 0,
    bajoStock,
    error: null,
  };
}

function Tarjeta({ estado, cantidad }: { estado: Semaforo; cantidad: number }) {
  const p = PRESENTACION_SEMAFORO[estado];
  return (
    <div className="flex overflow-hidden rounded-lg border border-gris-200">
      <div className={`w-2 shrink-0 ${p.barra}`} aria-hidden="true" />
      <div className="p-4">
        <p className="text-3xl font-bold text-gris-900">{cantidad}</p>
        <p className="mt-0.5 text-sm font-semibold text-gris-600">{p.etiqueta}</p>
      </div>
    </div>
  );
}

export default async function AdminPage() {
  // Segunda verificacion de rol, despues de la del layout. Es a proposito: esta
  // pagina podria ser alcanzada por un camino que no pase por el layout.
  const perfil = await perfilHabilitado();
  const conteos = await cargarConteos();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold text-gris-900">Resumen</h1>
        <p className="mt-1 text-base text-gris-600">
          Estado de los planes de mantención de la flota.
        </p>

        {conteos.error ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-acento p-4 text-sm font-medium text-gris-900"
          >
            No pude leer los datos: {conteos.error}
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ORDEN_SEMAFORO.map((e) => (
                <Tarjeta key={e} estado={e} cantidad={conteos.porSemaforo[e]} />
              ))}
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-gris-200 p-4">
                <dt className="text-sm font-semibold text-gris-600">Planes vigentes</dt>
                <dd className="mt-0.5 text-2xl font-bold text-gris-900">{conteos.totalPlanes}</dd>
              </div>
              <div className="rounded-lg border border-gris-200 p-4">
                <dt className="text-sm font-semibold text-gris-600">Activos fuera de servicio</dt>
                <dd className="mt-0.5 text-2xl font-bold text-gris-900">{conteos.fueraServicio}</dd>
              </div>
              <div className="rounded-lg border border-gris-200 p-4">
                <dt className="text-sm font-semibold text-gris-600">Repuestos bajo stock mínimo</dt>
                <dd className="mt-0.5 text-2xl font-bold text-gris-900">{conteos.bajoStock}</dd>
              </div>
            </dl>

            {conteos.porSemaforo.sin_linea_base > 0 ? (
              <p className="mt-3 text-sm text-gris-600">
                {conteos.porSemaforo.sin_linea_base} plan
                {conteos.porSemaforo.sin_linea_base === 1 ? "" : "es"} sin datos suficientes para
                calcular vencimiento. Falta fecha de adquisición, ejecución previa o lecturas de
                horómetro.
              </p>
            ) : null}
          </>
        )}
      </section>

      {perfil ? (
        <section className="rounded-lg border border-gris-200 p-5">
          <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">Tu acceso</h2>
          <p className="mt-2 text-base font-semibold text-gris-900">{ETIQUETA_ROL[perfil.rol]}</p>
          <p className="mt-1 text-sm text-gris-600">{DESCRIPCION_ROL[perfil.rol]}</p>
        </section>
      ) : null}

      <section className="border-t border-gris-200 pt-6">
        <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
          Lo que falta construir
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm text-gris-600">
          <li>Activos, con filtros y generación e impresión de etiquetas QR.</li>
          <li>Mantenciones, con líneas de repuestos y adjunto de factura.</li>
          <li>Maestros de repuestos y proveedores, con movimientos de stock.</li>
          <li>
            La tabla ordenada por criticidad, los gráficos de costo y la exportación a CSV, que
            completan este resumen.
          </li>
        </ul>
      </section>
    </div>
  );
}
