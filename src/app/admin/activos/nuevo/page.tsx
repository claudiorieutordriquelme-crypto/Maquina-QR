import Link from "next/link";
import { redirect } from "next/navigation";
import { PERMISOS, perfilHabilitado } from "@/lib/auth";
import { listarTiposActivo } from "@/lib/datos/activos";
import { FormularioActivo } from "./formulario";

export const dynamic = "force-dynamic";

export default async function NuevoActivoPage() {
  /*
    Tercer chequeo del mismo permiso, y los tres tienen razon de ser: el proxy
    redirige a quien no tiene sesion, el layout valida el perfil, y aca se valida
    el rol antes de mostrar el formulario. La cuarta y definitiva es la politica
    RLS cuando la accion intenta insertar. Ocultar el formulario no es seguridad;
    es evitarle a un lector el trabajo de llenarlo para que la base lo rechace.
  */
  const perfil = await perfilHabilitado();
  if (!perfil) redirect("/login");
  if (!PERMISOS.administrar.includes(perfil.rol)) redirect("/admin/activos");

  const tipos = await listarTiposActivo();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/activos" className="text-sm font-semibold text-primario hover:underline">
          Volver a activos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gris-900">Nuevo activo</h1>
        <p className="mt-1 text-base text-gris-600">
          Los campos con asterisco son obligatorios. El resto se puede completar
          después.
        </p>
      </div>

      <FormularioActivo tipos={tipos} />
    </div>
  );
}
