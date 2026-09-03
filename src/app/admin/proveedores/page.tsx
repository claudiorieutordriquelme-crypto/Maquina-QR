import { PERMISOS, perfilHabilitado } from "@/lib/auth";
import { listarProveedoresCompleto } from "@/lib/datos/maestros";
import { BorrarProveedor, CrearProveedor, EditarProveedor } from "./piezas";

export const dynamic = "force-dynamic";

export default async function ProveedoresPage() {
  const [perfil, { proveedores, error }] = await Promise.all([
    perfilHabilitado(),
    listarProveedoresCompleto(),
  ]);

  const puedeAdministrar = perfil ? PERMISOS.administrar.includes(perfil.rol) : false;
  const activos = proveedores.filter((p) => p.activo).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gris-900">Proveedores</h1>
          <p className="mt-1 text-base text-gris-600">
            {proveedores.length} en el maestro
            {proveedores.length !== activos ? `, ${activos} activos` : ""}
          </p>
        </div>
        {puedeAdministrar ? <CrearProveedor /> : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-acento p-4 text-sm font-medium text-gris-900">
          No pude leer los proveedores: {error}
        </p>
      ) : proveedores.length === 0 ? (
        <p className="rounded-lg border border-gris-200 p-6 text-base text-gris-600">
          El maestro de proveedores está vacío.
        </p>
      ) : (
        <ul className="space-y-3">
          {proveedores.map((p) => (
            <li key={p.id} className="flex overflow-hidden rounded-lg border border-gris-200">
              <div
                className={`w-2 shrink-0 ${p.activo ? "bg-primario" : "bg-gris-300"}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-gris-900">{p.nombre}</h2>
                    <p className="text-sm font-semibold text-gris-700">
                      {[p.rut, p.giro].filter(Boolean).join(" · ") || "Sin RUT registrado"}
                      {!p.activo ? " · inactivo" : ""}
                    </p>
                  </div>
                </div>

                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gris-600">
                  {p.contacto_nombre ? (
                    <div className="flex gap-1">
                      <dt className="font-semibold">Contacto:</dt>
                      <dd>{p.contacto_nombre}</dd>
                    </div>
                  ) : null}
                  {p.contacto_telefono ? (
                    <div className="flex gap-1">
                      <dt className="font-semibold">Teléfono:</dt>
                      <dd>{p.contacto_telefono}</dd>
                    </div>
                  ) : null}
                  {p.contacto_email ? (
                    <div className="flex gap-1">
                      <dt className="font-semibold">Correo:</dt>
                      <dd className="break-all">{p.contacto_email}</dd>
                    </div>
                  ) : null}
                  {p.direccion ? (
                    <div className="flex gap-1">
                      <dt className="font-semibold">Dirección:</dt>
                      <dd>{p.direccion}</dd>
                    </div>
                  ) : null}
                </dl>

                {p.notas ? <p className="mt-2 text-sm text-gris-600">{p.notas}</p> : null}

                {puedeAdministrar ? (
                  <div className="mt-3 flex flex-wrap items-start gap-4">
                    <EditarProveedor proveedor={p} />
                    <BorrarProveedor proveedor={p} />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="max-w-prose text-sm text-gris-500">
        El RUT se valida en la base de datos con módulo 11 y se normaliza por
        trigger antes de guardarse. No hay una segunda validación en la
        aplicación a propósito: dos implementaciones de la misma regla terminan
        discrepando, y la que manda es la de la base.
      </p>
    </div>
  );
}
