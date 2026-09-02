import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ETIQUETA_ROL, obtenerContexto, type Rol } from "@/lib/auth";
import { cerrarSesion } from "./acciones";

export const metadata: Metadata = {
  title: "Panel · Máquina QR",
  robots: { index: false, follow: false },
};

/*
  Secciones del panel. Las que ya existen llevan ruta y se enlazan; las que
  faltan se muestran en gris con la etapa en que llegan.

  No se pueden enlazar antes de existir porque Next 16 tipa las rutas y un
  <Link> hacia una ruta inexistente rompe el typecheck. Eso es una ayuda, no un
  estorbo: obliga a que el menu diga la verdad sobre lo que hay construido.
*/
type Seccion = {
  nombre: string;
  ruta?: "/admin" | "/admin/activos" | "/admin/mantenciones";
  etapa: number;
  roles: Rol[];
};

const SECCIONES: Seccion[] = [
  { nombre: "Resumen", ruta: "/admin", etapa: 5, roles: ["admin", "tecnico", "lector"] },
  { nombre: "Activos", ruta: "/admin/activos", etapa: 6, roles: ["admin", "tecnico", "lector"] },
  { nombre: "Mantenciones", ruta: "/admin/mantenciones", etapa: 7, roles: ["admin", "tecnico", "lector"] },
  { nombre: "Repuestos", etapa: 8, roles: ["admin", "tecnico", "lector"] },
  { nombre: "Proveedores", etapa: 8, roles: ["admin", "tecnico", "lector"] },
  { nombre: "Reportes", etapa: 9, roles: ["admin", "lector"] },
  { nombre: "Configuración", etapa: 10, roles: ["admin"] },
];

function SinAcceso({ motivo }: { motivo: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-bold text-gris-900">Sin acceso al panel</h1>
      <p className="mt-3 text-base text-gris-600">{motivo}</p>
      <form action={cerrarSesion} className="mt-7">
        <button
          type="submit"
          className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, perfil } = await obtenerContexto();

  // Sin sesion: el proxy ya deberia haber redirigido, pero una Server Function
  // invocada desde aca puede llegar sin pasar por el proxy.
  if (!user) redirect("/login");

  /*
    Con sesion pero sin perfil utilizable no se redirige a /login: el proxy veria
    la sesion ahi y devolveria a /admin, en bucle. Se muestra el estado y la
    salida.
  */
  if (!perfil) {
    return (
      <SinAcceso motivo="Tu cuenta existe pero no tiene un perfil asociado. Pide a un administrador que te asigne uno." />
    );
  }

  if (!perfil.activo) {
    return <SinAcceso motivo="Tu perfil está deshabilitado. Contacta a un administrador." />;
  }

  const visibles = SECCIONES.filter((s) => s.roles.includes(perfil.rol));

  return (
    <div className="min-h-dvh">
      <header className="border-b-4 border-primario print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs font-bold tracking-widest text-primario uppercase">
              Máquina QR
            </p>
            <p className="mt-0.5 text-base font-semibold text-gris-900">
              {perfil.nombre || perfil.email}
              <span className="ml-2 rounded border border-gris-300 px-1.5 py-0.5 align-middle text-xs font-semibold text-gris-600">
                {ETIQUETA_ROL[perfil.rol]}
              </span>
            </p>
          </div>

          <form action={cerrarSesion}>
            <button
              type="submit"
              className="rounded-md border border-gris-300 px-3 py-2 text-sm font-semibold text-gris-800 transition-colors hover:border-gris-500"
            >
              Cerrar sesión
            </button>
          </form>
        </div>

        <nav aria-label="Secciones del panel" className="mx-auto max-w-5xl px-5 pb-3">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {visibles.map((s) => (
              <li key={s.nombre}>
                {s.ruta ? (
                  <Link
                    href={s.ruta}
                    className="pb-1 text-sm font-semibold text-gris-900 hover:text-primario"
                  >
                    {s.nombre}
                  </Link>
                ) : (
                  <span
                    className="pb-1 text-sm font-medium text-gris-400"
                    title={`Se construye en la etapa ${s.etapa}`}
                  >
                    {s.nombre}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-7">{children}</div>
    </div>
  );
}
