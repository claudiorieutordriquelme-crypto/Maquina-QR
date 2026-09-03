/*
  Roles y sus etiquetas, en un modulo sin dependencias de servidor.

  Por que viven aca y no en lib/auth: auth importa el cliente de Supabase de
  servidor, que a su vez usa next/headers. Cualquier componente de cliente que
  importara una etiqueta desde auth arrastraba todo ese arbol al navegador y el
  build fallaba. Separar los nombres de los roles de la logica de autorizacion
  deja que la interfaz los use sin acercarse a la sesion.

  Lo que NO va aca es ninguna decision de permisos. Eso vive en lib/auth y en
  las politicas RLS, y tiene que quedar del lado del servidor.
*/

export type Rol = "admin" | "tecnico" | "lector";

/** Orden de mayor a menor privilegio. Sirve para listar y para recorrer. */
export const ROLES: Rol[] = ["admin", "tecnico", "lector"];

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
