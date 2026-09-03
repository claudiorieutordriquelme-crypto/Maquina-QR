import { crearClienteServidor } from "@/lib/supabase/server";
import type { Rol } from "@/lib/auth";

/*
  Lectura de la configuracion del sistema.

  Las dos tablas de ajustes son de una sola fila, con id booleano y default
  true: el primary key impide que existan dos configuraciones compitiendo. Por
  eso todas las consultas de aca usan maybeSingle sin filtro.

  Cada funcion devuelve el dato Y el error por separado. Un fallo de lectura que
  se devuelve como null se ve identico a "todavia no hay nada", y esa confusion
  ya costo caro en el libro de stock: la pantalla decia "sin movimientos" cuando
  en realidad la consulta habia fallado.
*/

export type Configuracion = {
  mostrar_costos_publico: boolean;
  dias_alerta_proxima: number;
  dias_alerta_critica: number;
  moneda: string;
  nombre_organizacion: string;
};

export type ParametrosCalculo = {
  ventana_tasa_uso_dias: number;
  min_lecturas_tasa: number;
  min_span_tasa_dias: number;
  historial_publico_limite: number;
};

export type UsuarioPanel = {
  id: string;
  user_id: string;
  nombre: string;
  email: string | null;
  rol: Rol;
  activo: boolean;
  created_at: string;
};

export async function cargarConfiguracion(): Promise<{
  config: Configuracion | null;
  error: string | null;
}> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("configuracion")
    .select(
      "mostrar_costos_publico, dias_alerta_proxima, dias_alerta_critica, moneda, nombre_organizacion",
    )
    .maybeSingle();

  if (error) {
    console.error("No pude leer la configuración:", error.message);
    return { config: null, error: error.message };
  }
  return { config: (data as Configuracion | null) ?? null, error: null };
}

export async function cargarParametros(): Promise<{
  parametros: ParametrosCalculo | null;
  error: string | null;
}> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("parametros_calculo")
    .select(
      "ventana_tasa_uso_dias, min_lecturas_tasa, min_span_tasa_dias, historial_publico_limite",
    )
    .maybeSingle();

  if (error) {
    console.error("No pude leer los parámetros de cálculo:", error.message);
    return { parametros: null, error: error.message };
  }
  return { parametros: (data as ParametrosCalculo | null) ?? null, error: null };
}

/*
  Usuarios del panel.

  Se listan desde profiles y no desde auth.users, porque el schema auth no es
  alcanzable con la llave publica y esta aplicacion no usa service_role. La
  consecuencia practica hay que decirla en pantalla: desde aca se cambia el rol
  y se habilita o deshabilita una cuenta, pero no se invita gente nueva. Alguien
  entra a este listado recien despues de registrarse.

  Se ordena por rol y despues por nombre. Alfabetico puro deja al administrador
  perdido entre los lectores, y el rol es justamente lo que se viene a revisar.
*/
const ORDEN_ROL: Record<Rol, number> = { admin: 1, tecnico: 2, lector: 3 };

export async function listarUsuarios(): Promise<{
  usuarios: UsuarioPanel[];
  error: string | null;
}> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, nombre, email, rol, activo, created_at");

  if (error) {
    console.error("No pude leer los usuarios:", error.message);
    return { usuarios: [], error: error.message };
  }

  const usuarios = ((data ?? []) as UsuarioPanel[]).sort((a, b) => {
    if (a.activo !== b.activo) return a.activo ? -1 : 1;
    const r = ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol];
    if (r !== 0) return r;
    return (a.nombre || a.email || "").localeCompare(b.nombre || b.email || "", "es");
  });

  return { usuarios, error: null };
}
