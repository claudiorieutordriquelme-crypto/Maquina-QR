import { PERMISOS, perfilHabilitado } from "@/lib/auth";
import { listarMovimientos, listarRepuestosCompleto } from "@/lib/datos/maestros";
import { listarProveedores } from "@/lib/datos/mantenciones";
import { formateaFechaCorta, formateaNumero, formateaPesos } from "@/lib/formato";
import { CrearRepuesto, EditarRepuesto, RegistrarMovimiento } from "./piezas";

export const dynamic = "force-dynamic";

const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  ingreso: "Ingreso",
  consumo: "Consumo",
  ajuste: "Ajuste",
};

export default async function RepuestosPage() {
  const [perfil, { repuestos, error }, proveedores, { movimientos }] = await Promise.all([
    perfilHabilitado(),
    listarRepuestosCompleto(),
    listarProveedores(),
    listarMovimientos(),
  ]);

  const puedeOperar = perfil ? PERMISOS.operar.includes(perfil.rol) : false;
  const puedeAdministrar = perfil ? PERMISOS.administrar.includes(perfil.rol) : false;
  const bajoMinimo = repuestos.filter((r) => r.bajo_minimo && r.activo);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gris-900">Repuestos</h1>
          <p className="mt-1 text-base text-gris-600">
            {repuestos.length} en el maestro
            {bajoMinimo.length > 0 ? ` · ${bajoMinimo.length} bajo stock mínimo` : ""}
          </p>
        </div>
        {puedeAdministrar ? <CrearRepuesto proveedores={proveedores} /> : null}
      </div>

      {/* La alerta de stock minimo va arriba y con la barra de acento porque es
          lo unico de esta pantalla que exige actuar hoy. */}
      {bajoMinimo.length > 0 ? (
        <div className="flex overflow-hidden rounded-lg border border-gris-200">
          <div className="w-2 shrink-0 bg-acento" aria-hidden="true" />
          <div className="p-4">
            <h2 className="text-sm font-bold text-gris-900">
              {bajoMinimo.length} {bajoMinimo.length === 1 ? "repuesto" : "repuestos"} bajo stock
              mínimo
            </h2>
            <ul className="mt-1.5 space-y-0.5 text-sm text-gris-700">
              {bajoMinimo.map((r) => (
                <li key={r.id}>
                  {r.codigo} · {r.nombre}: quedan {formateaNumero(r.stock_actual)} {r.unidad_medida}{" "}
                  y el mínimo es {formateaNumero(r.stock_minimo)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md border border-acento p-4 text-sm font-medium text-gris-900">
          No pude leer los repuestos: {error}
        </p>
      ) : repuestos.length === 0 ? (
        <p className="rounded-lg border border-gris-200 p-6 text-base text-gris-600">
          El maestro de repuestos está vacío.
        </p>
      ) : (
        <ul className="space-y-3">
          {repuestos.map((r) => (
            <li key={r.id} className="flex overflow-hidden rounded-lg border border-gris-200">
              <div
                className={`w-2 shrink-0 ${
                  !r.activo ? "bg-gris-300" : r.bajo_minimo ? "bg-acento" : "bg-secundario"
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 flex-wrap p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-gris-500 uppercase">
                      {r.codigo}
                      {!r.activo ? " · inactivo" : ""}
                    </p>
                    <h2 className="text-lg font-bold text-gris-900">{r.nombre}</h2>
                    {r.descripcion ? (
                      <p className="mt-0.5 text-sm text-gris-600">{r.descripcion}</p>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-lg font-bold ${
                        r.bajo_minimo ? "text-gris-900" : "text-gris-900"
                      }`}
                    >
                      {formateaNumero(r.stock_actual)} {r.unidad_medida}
                    </p>
                    <p className="text-xs text-gris-500">
                      mínimo {formateaNumero(r.stock_minimo)}
                      {r.bajo_minimo ? " · bajo el mínimo" : ""}
                    </p>
                  </div>
                </div>

                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gris-600">
                  <div className="flex gap-1">
                    <dt className="font-semibold">Costo referencia:</dt>
                    <dd>{formateaPesos(r.costo_unitario_referencia)}</dd>
                  </div>
                  {r.proveedor_nombre ? (
                    <div className="flex gap-1">
                      <dt className="font-semibold">Proveedor:</dt>
                      <dd>{r.proveedor_nombre}</dd>
                    </div>
                  ) : null}
                </dl>

                {puedeAdministrar ? (
                  <div className="mt-2">
                    <EditarRepuesto repuesto={r} proveedores={proveedores} />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {puedeOperar ? <RegistrarMovimiento repuestos={repuestos.filter((r) => r.activo)} /> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
          Libro de movimientos
        </h2>
        <p className="text-sm text-gris-600">
          Append only. Ni un administrador puede borrar una fila: una corrección
          se hace con un ajuste compensatorio, que queda registrado.
        </p>

        {movimientos.length === 0 ? (
          <p className="rounded-lg border border-gris-200 p-4 text-sm text-gris-600">
            Sin movimientos registrados.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gris-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gris-200 text-left text-xs font-semibold tracking-wide text-gris-500 uppercase">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Repuesto</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-b border-gris-100 last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap text-gris-700">
                      {formateaFechaCorta(m.created_at)}
                    </td>
                    <td className="px-3 py-2 font-medium text-gris-900">
                      {m.repuesto_codigo} · {m.repuesto_nombre}
                    </td>
                    <td className="px-3 py-2 text-gris-700">
                      {ETIQUETA_MOVIMIENTO[m.tipo] ?? m.tipo}
                      {m.orden_id ? (
                        <span className="ml-1 text-xs text-gris-500">(desde una orden)</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gris-900">
                      {formateaNumero(m.cantidad)}
                    </td>
                    <td className="px-3 py-2 text-gris-600">{m.motivo ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
