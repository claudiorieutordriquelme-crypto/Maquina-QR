import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ETIQUETA_ROL, obtenerContexto, type Rol } from "@/lib/auth";
import { LogoCliente } from "@/components/logo-cliente";
import { Tutorial } from "@/components/tutorial/tutorial";
import { cerrarSesion } from "./acciones";
import { NavPanel, type ItemNav } from "./nav";

export const metadata: Metadata = {
  title: "Panel · Máquina QR",
  robots: { index: false, follow: false },
};

/*
  Secciones del panel. Las que ya existen llevan ruta y se enlazan; las que
  faltan van al final, en gris y con la etapa en que llegan.

  No se pueden enlazar antes de existir porque Next 16 tipa las rutas y un
  <Link> hacia una ruta inexistente rompe el typecheck. Eso es una ayuda, no un
  estorbo: obliga a que el menu diga la verdad sobre lo que hay construido.
*/
type Seccion = ItemNav & { roles: Rol[] };

const SECCIONES: Seccion[] = [
  { nombre: "Resumen", ruta: "/admin", etapa: 5, roles: ["admin", "tecnico", "lector"] },
  { nombre: "Activos", ruta: "/admin/activos", etapa: 6, roles: ["admin", "tecnico", "lector"] },
  {
    nombre: "Mantenciones",
    ruta: "/admin/mantenciones",
    etapa: 7,
    roles: ["admin", "tecnico", "lector"],
  },
  { nombre: "Repuestos", ruta: "/admin/repuestos", etapa: 8, roles: ["admin", "tecnico", "lector"] },
  {
    nombre: "Proveedores",
    ruta: "/admin/proveedores",
    etapa: 8,
    roles: ["admin", "tecnico", "lector"],
  },
  {
    nombre: "Reportes",
    ruta: "/admin/reportes",
    etapa: 9,
    /*
      Tambien el tecnico. Es el que escribe los montos de mano de obra y de
      factura en cada orden, asi que esconderle el agregado no protegia nada:
      la base no filtra costos entre roles internos, solo hacia la ficha
      publica. Un enlace escondido sobre datos que el rol si puede leer es una
      molestia, no un control.
    */
    roles: ["admin", "tecnico", "lector"],
  },
  { nombre: "Configuración", ruta: "/admin/configuracion", etapa: 10, roles: ["admin"] },
];

function SinAcceso({ motivo }: { motivo: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <LogoCliente className="mb-6 h-20 w-28" conTexto />
      <h1 className="text-2xl font-bold text-gris-900">Sin acceso al panel</h1>
      <p className="mt-3 text-base text-gris-600">{motivo}</p>
      <form action={cerrarSesion} className="mt-7">
        <button
          type="submit"
          className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800 transition-colors hover:border-gris-500"
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

    Este mensaje tambien sale cuando falla la lectura de la tabla de perfiles.
    Si la persona esta segura de tener perfil, el problema no es de asignacion
    sino de lectura, y hay que mirar el registro del servidor.
  */
  if (!perfil) {
    return (
      <SinAcceso motivo="Tu cuenta existe pero no tiene un perfil asociado, o el sistema no pudo leerlo. Pide a un administrador que lo revise." />
    );
  }

  if (!perfil.activo) {
    return <SinAcceso motivo="Tu perfil está deshabilitado. Contacta a un administrador." />;
  }

  const visibles = SECCIONES.filter((s) => s.roles.includes(perfil.rol));

  return (
    <div className="min-h-dvh bg-gris-50">
      {/*
        El encabezado queda fijo arriba. En listados largos, como el libro de
        movimientos o una flota de cuarenta maquinas, perder la navegacion al
        bajar obliga a subir hasta el tope para cambiar de seccion. El fondo va
        translucido con blur para que se note que hay contenido debajo.
      */}
      <header className="sticky top-0 z-20 border-b border-gris-200 bg-blanco/90 shadow-barra backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <LogoCliente className="h-9 w-12 shrink-0 sm:h-10 sm:w-14" />
            <div className="min-w-0" data-tour="identidad">
              <p className="text-xs font-bold tracking-widest text-primario uppercase">
                Máquina QR
              </p>
              <p className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold text-gris-900">
                {/* Con perfil sin nombre ni correo, la linea quedaba vacia y
                    solo se veia la etiqueta del rol. */}
                <span className="truncate">
                  {perfil.nombre || perfil.email || "Sin nombre registrado"}
                </span>
                <span className="rounded border border-gris-300 px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-gris-600">
                  {ETIQUETA_ROL[perfil.rol]}
                </span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Tutorial rol={perfil.rol} />
            <form action={cerrarSesion}>
              <button
                type="submit"
                className="shrink-0 rounded-md border border-gris-300 px-3 py-2 text-sm font-semibold text-gris-800 transition-colors hover:border-gris-500 hover:text-gris-900"
              >
                <span className="sm:hidden">Salir</span>
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>
            </form>
          </div>
        </div>

        <div data-tour="nav">
          <NavPanel items={visibles} />
        </div>
      </header>

      {/*
        El contenido va sobre una tarjeta blanca con el fondo gris detras. Da
        limite visual al area de trabajo sin depender de sombras marcadas, que
        con sol directo sobre la pantalla se ven como suciedad. Al imprimir se
        desarma para no gastar tinta en bordes.
      */}
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-7">
        <div className="rounded-xl border border-gris-200 bg-blanco p-4 shadow-tarjeta sm:p-6 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {children}
        </div>
      </div>
    </div>
  );
}
