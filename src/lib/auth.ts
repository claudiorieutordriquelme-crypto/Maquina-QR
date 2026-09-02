import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";

/*
  Sesion y rol, del lado del servidor.

  Aca esta la capa de autorizacion real de la aplicacion, junto con las
  politicas RLS. src/proxy.ts hace un chequeo optimista para redirigir a /login,
  pero eso es comodidad de navegacion, no seguridad: cualquier Server Action o
  Route Handler tiene que verificar el rol por su cuenta, porque un matcher que
  excluye una ruta tambien excluye las Server Functions de esa ruta.
*/

export type Rol = "admin" | "tecnico" | "lector";

export type Perfil = {
  id: string;
  user_id: string;
  nombre: string;
  email: string | null;
  rol: Rol;
  activo: boolean;
};

export type Contexto = {
  /** Sesion valida contra el servidor de Auth. */
  user: User | null;
  /** Fila de profiles. Puede faltar aunque haya sesion. */
  perfil: Perfil | null;
};

/*
  Se devuelven los dos juntos, y no solo el perfil, porque hay que poder
  distinguir "no hay sesion" de "hay sesion pero el perfil esta deshabilitado".
  Si los dos casos se trataran igual y redirigieran a /login, el segundo entra
  en bucle: el proxy ve la sesion en /login y devuelve a /admin, que vuelve a
  redirigir a /login.

  getUser y no getSession, y la diferencia importa: getSession devuelve lo que
  venga en la cookie sin validarlo contra el servidor de Auth, asi que sirve
  para pintar una interfaz pero no para decidir permisos.

  cache() lo memoriza por request: el layout, la pagina y cada accion piden esto,
  y sin memorizar serian varias validaciones de token por navegacion.
*/
export const obtenerContexto = cache(async (): Promise<Contexto> => {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
    error: errorUsuario,
  } = await supabase.auth.getUser();

  if (errorUsuario || !user) return { user: null, perfil: null };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, nombre, email, rol, activo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("No pude leer el perfil:", error.message);
    return { user, perfil: null };
  }

  return { user, perfil: (data as Perfil | null) ?? null };
});

/** Perfil solo si hay sesion, existe la fila y esta habilitada. */
export async function perfilHabilitado(): Promise<Perfil | null> {
  const { perfil } = await obtenerContexto();
  return perfil && perfil.activo ? perfil : null;
}

export const PERMISOS = {
  /** Ve el panel. */
  leer: ["admin", "tecnico", "lector"] as Rol[],
  /** Registra mantenciones, consume repuestos, sube adjuntos, toma lecturas. */
  operar: ["admin", "tecnico"] as Rol[],
  /** Maestros, configuracion, usuarios y cualquier borrado. */
  administrar: ["admin"] as Rol[],
};

/*
  Guarda para Server Actions y Route Handlers. Lanza en vez de redirigir a
  proposito: una accion no autorizada tiene que interrumpirse, no continuar y
  confiar en que la base la va a frenar. La base tambien la va a frenar, y eso
  es defensa en profundidad, no un reemplazo de este chequeo.
*/
export async function requiereRol(roles: Rol[]): Promise<Perfil> {
  const perfil = await perfilHabilitado();

  if (!perfil) {
    throw new Error("Necesitas iniciar sesión para hacer esto.");
  }

  if (!roles.includes(perfil.rol)) {
    throw new Error("Tu rol no tiene permiso para esta acción.");
  }

  return perfil;
}

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administrador",
  tecnico: "Técnico",
  lector: "Lector",
};

export const DESCRIPCION_ROL: Record<Rol, string> = {
  admin: "Acceso total: activos, mantenciones, maestros, usuarios y configuración.",
  tecnico: "Registra y edita mantenciones, consume repuestos y toma lecturas. No borra.",
  lector: "Solo lectura del panel.",
};
