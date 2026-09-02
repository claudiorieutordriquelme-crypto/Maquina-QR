import Link from "next/link";
import { notFound } from "next/navigation";
import { PERMISOS, perfilHabilitado } from "@/lib/auth";
import {
  ETIQUETA_ESTADO_ORDEN,
  listarProveedores,
  listarRepuestos,
  obtenerOrden,
} from "@/lib/datos/mantenciones";
import {
  ETIQUETA_TIPO_MANTENCION,
  formateaFechaCorta,
  formateaHoras,
  formateaNumero,
  formateaPesos,
} from "@/lib/formato";
import {
  AgregarLinea,
  BotonEliminarLinea,
  BotonVerDocumento,
  FormularioEditarOrden,
  SubirFactura,
} from "./piezas";

export const dynamic = "force-dynamic";

export default async function OrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ orden, lineas, documentos }, perfil, proveedores, repuestos] = await Promise.all([
    obtenerOrden(id),
    perfilHabilitado(),
    listarProveedores(),
    listarRepuestos(),
  ]);

  if (!orden) notFound();

  const puedeOperar = perfil ? PERMISOS.operar.includes(perfil.rol) : false;
  const puedeAdministrar = perfil ? PERMISOS.administrar.includes(perfil.rol) : false;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/mantenciones"
          className="text-sm font-semibold text-primario hover:underline"
        >
          Volver a mantenciones
        </Link>
        <p className="mt-2 text-xs font-semibold tracking-wide text-gris-500 uppercase">
          Folio {orden.folio} · {ETIQUETA_TIPO_MANTENCION[orden.tipo]} ·{" "}
          {ETIQUETA_ESTADO_ORDEN[orden.estado]}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gris-900">
          {orden.activo_codigo} · {orden.activo_nombre}
        </h1>
        {orden.plan_nombre ? (
          <p className="mt-0.5 text-base font-semibold text-gris-700">{orden.plan_nombre}</p>
        ) : (
          <p className="mt-0.5 text-base text-gris-600">Sin plan asociado</p>
        )}
      </div>

      {/* Los montos van arriba porque es lo primero que se revisa al abrir una
          orden. costo_total es columna generada: no se puede editar, solo se
          mueve cambiando sus tres componentes. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { etiqueta: "Mano de obra", valor: orden.monto_mano_obra },
          { etiqueta: "Repuestos", valor: orden.monto_repuestos },
          { etiqueta: "Otros", valor: orden.monto_otros },
        ].map((m) => (
          <div key={m.etiqueta} className="rounded-lg border border-gris-200 p-3">
            <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
              {m.etiqueta}
            </p>
            <p className="mt-0.5 text-lg font-bold text-gris-900">{formateaPesos(m.valor)}</p>
          </div>
        ))}
        <div className="rounded-lg border-2 border-primario p-3">
          <p className="text-xs font-semibold tracking-wide text-primario uppercase">Costo total</p>
          <p className="mt-0.5 text-lg font-bold text-gris-900">
            {formateaPesos(orden.costo_total)}
          </p>
          <p className="mt-0.5 text-xs text-gris-500">Calculado por la base</p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
            Repuestos usados
          </h2>
          <p className="text-sm text-gris-600">
            {lineas.length} {lineas.length === 1 ? "línea" : "líneas"} ·{" "}
            {formateaPesos(orden.monto_repuestos)}
          </p>
        </div>

        {lineas.length === 0 ? (
          <p className="rounded-lg border border-gris-200 p-4 text-sm text-gris-600">
            Esta orden no tiene repuestos registrados.
          </p>
        ) : (
          <>
          {/* Bajo 640 px, tarjetas: cuatro columnas mas la accion de eliminar no
              caben en un telefono. */}
          <ul className="space-y-2 sm:hidden">
            {lineas.map((l) => (
              <li key={l.id} className="rounded-lg border border-gris-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-semibold text-gris-900">
                    {l.repuesto_nombre ?? l.descripcion_libre ?? "Sin descripción"}
                    {!l.repuesto_id ? (
                      <span className="ml-1 text-xs font-normal text-gris-500">
                        (fuera del maestro)
                      </span>
                    ) : null}
                  </p>
                  <p className="shrink-0 text-base font-bold text-gris-900">
                    {formateaPesos(l.subtotal)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-gris-600">
                  {formateaNumero(l.cantidad)} {l.repuesto_unidad ?? ""} ×{" "}
                  {formateaPesos(l.costo_unitario)}
                </p>
                {puedeAdministrar ? (
                  <div className="mt-2">
                    <BotonEliminarLinea id={l.id} ordenId={orden.id} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border border-gris-200 sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gris-200 text-left text-xs font-semibold tracking-wide text-gris-500 uppercase">
                  <th className="px-3 py-2">Repuesto</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2 text-right">Costo unitario</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  {puedeAdministrar ? <th className="px-3 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.id} className="border-b border-gris-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-gris-900">
                      {l.repuesto_nombre ?? l.descripcion_libre ?? "Sin descripción"}
                      {!l.repuesto_id ? (
                        <span className="ml-2 text-xs text-gris-500">(fuera del maestro)</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right text-gris-700">
                      {formateaNumero(l.cantidad)} {l.repuesto_unidad ?? ""}
                    </td>
                    <td className="px-3 py-2 text-right text-gris-700">
                      {formateaPesos(l.costo_unitario)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gris-900">
                      {formateaPesos(l.subtotal)}
                    </td>
                    {puedeAdministrar ? (
                      <td className="px-3 py-2 text-right">
                        <BotonEliminarLinea id={l.id} ordenId={orden.id} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {puedeOperar ? <AgregarLinea ordenId={orden.id} repuestos={repuestos} /> : null}

        {!puedeAdministrar && puedeOperar && lineas.length > 0 ? (
          <p className="text-sm text-gris-500">
            Tu rol puede agregar líneas pero no eliminarlas. Si digitaste una mal,
            pide a un administrador que la borre.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">Documentos</h2>

        {documentos.length === 0 ? (
          <p className="rounded-lg border border-gris-200 p-4 text-sm text-gris-600">
            Sin documentos adjuntos.
          </p>
        ) : (
          <ul className="divide-y divide-gris-100 rounded-lg border border-gris-200">
            {documentos.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold break-all text-gris-900">
                    {d.nombre_archivo}
                  </p>
                  <p className="text-xs text-gris-500">
                    {d.tipo_documento} ·{" "}
                    {d.tamano_bytes ? `${Math.round(d.tamano_bytes / 1024)} KB · ` : ""}
                    {formateaFechaCorta(d.created_at)}
                  </p>
                </div>
                <BotonVerDocumento storagePath={d.storage_path} />
              </li>
            ))}
          </ul>
        )}

        {puedeOperar ? <SubirFactura ordenId={orden.id} /> : null}
      </section>

      <section className="space-y-3 border-t border-gris-200 pt-6">
        <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
          Datos de la orden
        </h2>

        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-gris-600">
          {orden.horometro_ejecucion !== null ? (
            <div className="flex gap-1">
              <dt className="font-semibold">Horómetro:</dt>
              <dd>{formateaHoras(orden.horometro_ejecucion)}</dd>
            </div>
          ) : null}
          {orden.proveedor_nombre ? (
            <div className="flex gap-1">
              <dt className="font-semibold">Proveedor:</dt>
              <dd>{orden.proveedor_nombre}</dd>
            </div>
          ) : null}
          <div className="flex gap-1">
            <dt className="font-semibold">Ejecución:</dt>
            <dd>{formateaFechaCorta(orden.fecha_ejecucion)}</dd>
          </div>
        </dl>

        <FormularioEditarOrden
          orden={orden}
          proveedores={proveedores}
          puedeOperar={puedeOperar}
        />
      </section>
    </div>
  );
}
