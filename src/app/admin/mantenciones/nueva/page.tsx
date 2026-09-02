import Link from "next/link";
import { redirect } from "next/navigation";
import { PERMISOS, perfilHabilitado } from "@/lib/auth";
import {
  listarActivosSimple,
  listarProveedores,
  listarTodosLosPlanes,
} from "@/lib/datos/mantenciones";
import { FormularioOrden } from "./formulario";

export const dynamic = "force-dynamic";

export default async function NuevaMantencionPage() {
  const perfil = await perfilHabilitado();
  if (!perfil) redirect("/login");
  if (!PERMISOS.operar.includes(perfil.rol)) redirect("/admin/mantenciones");

  const [activos, planes, proveedores] = await Promise.all([
    listarActivosSimple(),
    listarTodosLosPlanes(),
    listarProveedores(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/mantenciones"
          className="text-sm font-semibold text-primario hover:underline"
        >
          Volver a mantenciones
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gris-900">Nueva mantención</h1>
        <p className="mt-1 max-w-prose text-base text-gris-600">
          Primero se crea la orden y después se le agregan los repuestos y la
          factura. Es el orden que impone el modelo, porque cada línea de
          repuesto necesita una orden a la que pertenecer, y también el orden
          real del trabajo.
        </p>
      </div>

      {activos.length === 0 ? (
        <p className="rounded-lg border border-gris-200 p-6 text-base text-gris-600">
          No hay activos cargados todavía. Carga uno antes de registrar una
          mantención.
        </p>
      ) : (
        <FormularioOrden activos={activos} planes={planes} proveedores={proveedores} />
      )}
    </div>
  );
}
