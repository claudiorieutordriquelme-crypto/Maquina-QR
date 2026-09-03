"use server";

import { revalidatePath } from "next/cache";
import { PERMISOS, obtenerContexto, requiereRol, type Rol } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoConfig = { error?: string; ok?: string };

const texto = (d: FormData, c: string) => String(d.get(c) ?? "").trim();

/*
  Los enteros se leen a mano y no con Number() a secas porque Number("") es 0.
  Un campo vaciado por accidente pondria el umbral critico en cero dias y el
  semaforo dejaria de avisar sin que nadie note el cambio.
*/
function entero(d: FormData, c: string): number | null {
  const bruto = texto(d, c);
  if (!/^-?\d+$/.test(bruto)) return null;
  return Number(bruto);
}

function traduce(codigo: string | undefined, mensaje: string): string {
  if (codigo === "42501") return "Tu rol no tiene permiso para esta operación.";
  if (codigo === "23514") {
    if (mensaje.includes("umbrales")) {
      return "El aviso de próxima tiene que ser mayor que el de crítica, y ninguno puede ser negativo.";
    }
    if (mensaje.includes("parametros_rangos")) {
      return "Algún parámetro quedó fuera del rango permitido. Revisa los límites indicados bajo cada campo.";
    }
    return "Los datos no cumplen una regla de la base.";
  }
  console.error("Error de base al guardar configuración:", mensaje);
  return "No pude guardar. Revisa los datos e intenta de nuevo.";
}

const ROLES: Rol[] = ["admin", "tecnico", "lector"];

export async function guardarConfiguracion(
  _p: EstadoConfig,
  datos: FormData,
): Promise<EstadoConfig> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const proxima = entero(datos, "dias_alerta_proxima");
  const critica = entero(datos, "dias_alerta_critica");
  if (proxima === null || critica === null) {
    return { error: "Los dos umbrales tienen que ser números enteros de días." };
  }
  /*
    La base tiene el mismo check, y esa es la barrera real. Aca se repite solo
    para dar el mensaje en el idioma del usuario en vez de traducir despues un
    "violates check constraint configuracion_umbrales".
  */
  if (critica < 0) return { error: "El umbral crítico no puede ser negativo." };
  if (proxima <= critica) {
    return { error: "El aviso de próxima tiene que dar más días que el de crítica." };
  }

  const nombre = texto(datos, "nombre_organizacion");
  const moneda = texto(datos, "moneda").toUpperCase();
  if (!/^[A-Z]{3}$/.test(moneda)) {
    return { error: "La moneda va en código de tres letras, por ejemplo CLP." };
  }

  const mostrar = texto(datos, "mostrar_costos_publico") === "1";

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("configuracion")
    .update({
      dias_alerta_proxima: proxima,
      dias_alerta_critica: critica,
      nombre_organizacion: nombre,
      moneda,
      mostrar_costos_publico: mostrar,
    })
    .eq("id", true);

  if (error) return { error: traduce(error.code, error.message) };

  /*
    El semaforo de todo el panel sale de esos dos umbrales, asi que cambiarlos
    repinta activos, resumen y ficha publica. Se invalidan las rutas afectadas y
    no solo esta pantalla.
  */
  revalidatePath("/admin");
  revalidatePath("/admin/activos");
  revalidatePath("/admin/configuracion");

  return {
    ok: mostrar
      ? "Guardado. Ojo: los costos quedaron VISIBLES en la ficha pública de cada QR."
      : "Guardado. Los costos siguen ocultos en la ficha pública.",
  };
}

export async function guardarParametros(_p: EstadoConfig, datos: FormData): Promise<EstadoConfig> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const campos = {
    ventana_tasa_uso_dias: entero(datos, "ventana_tasa_uso_dias"),
    min_lecturas_tasa: entero(datos, "min_lecturas_tasa"),
    min_span_tasa_dias: entero(datos, "min_span_tasa_dias"),
    historial_publico_limite: entero(datos, "historial_publico_limite"),
  };

  if (Object.values(campos).some((v) => v === null)) {
    return { error: "Todos los parámetros tienen que ser números enteros." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("parametros_calculo").update(campos).eq("id", true);
  if (error) return { error: traduce(error.code, error.message) };

  revalidatePath("/admin");
  revalidatePath("/admin/activos");
  revalidatePath("/admin/configuracion");
  return { ok: "Parámetros de cálculo actualizados." };
}

/*
  Cambio de rol y de estado de una cuenta.

  LA GUARDA IMPORTANTE: nunca quedar sin ningun administrador activo. RLS deja
  que un admin se baje a lector a si mismo, y el resultado seria una instalacion
  sin nadie que pueda tocar configuracion, maestros ni usuarios. Como esta
  aplicacion no usa service_role, salir de ese estado exigiria SQL directo
  contra la base.

  Limite conocido y anotado: esta verificacion es de aplicacion, y dos
  administradores que se degraden en el mismo instante podrian pasar los dos.
  La guarda definitiva es el trigger de
  supabase/migrations/20260902130000_guarda_ultimo_admin.sql, que hay que
  aplicar en la base.
*/
export async function cambiarUsuario(_p: EstadoConfig, datos: FormData): Promise<EstadoConfig> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const id = texto(datos, "id");
  const rol = texto(datos, "rol") as Rol;
  const activo = texto(datos, "activo") === "1";
  if (!id) return { error: "Falta el usuario." };
  if (!ROLES.includes(rol)) return { error: "Ese rol no existe." };

  const supabase = await crearClienteServidor();

  const { data: objetivo, error: errorLectura } = await supabase
    .from("profiles")
    .select("id, user_id, nombre, email, rol, activo")
    .eq("id", id)
    .maybeSingle();

  if (errorLectura) return { error: traduce(errorLectura.code, errorLectura.message) };
  if (!objetivo) return { error: "Ese usuario ya no existe." };

  const dejaDeSerAdmin = objetivo.rol === "admin" && objetivo.activo && (rol !== "admin" || !activo);

  if (dejaDeSerAdmin) {
    const { count, error: errorConteo } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("rol", "admin")
      .eq("activo", true);

    if (errorConteo) return { error: traduce(errorConteo.code, errorConteo.message) };

    if ((count ?? 0) <= 1) {
      const { perfil } = await obtenerContexto();
      const esUnoMismo = perfil?.id === objetivo.id;
      return {
        error: esUnoMismo
          ? "Eres el único administrador activo. Nombra a otro administrador antes de cambiar tu propio rol, o nadie podrá volver a entrar a esta sección."
          : "Es el único administrador activo. Nombra a otro antes de cambiarle el rol.",
      };
    }
  }

  const { error } = await supabase.from("profiles").update({ rol, activo }).eq("id", id);
  if (error) return { error: traduce(error.code, error.message) };

  revalidatePath("/admin/configuracion");

  const quien = objetivo.nombre || objetivo.email || "El usuario";
  return { ok: `${quien}: ${activo ? "habilitado" : "deshabilitado"}, rol ${rol}.` };
}
