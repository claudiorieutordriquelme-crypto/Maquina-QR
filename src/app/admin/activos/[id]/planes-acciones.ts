"use server";

import { revalidatePath } from "next/cache";
import { PERMISOS, requiereRol } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

/*
  Planes de mantencion: crear, editar y borrar desde el panel.

  Hasta ahora los planes se cargaban por SQL, y la ficha del activo lo decia con
  todas sus letras. Era el hueco mas grande del sistema: el plan es lo que
  genera el semaforo, o sea lo unico que hace que esta aplicacion avise algo. Sin
  poder crearlo desde el panel, cargar una maquina nueva dejaba una ficha que no
  vigila nada.

  Rol: administrar. Es la politica que ya tenia la tabla en la base
  (planes_admin, for all to authenticated using es_admin()), y se respeta en vez
  de inventar una nueva. Un tecnico registra el trabajo; definir cada cuanto se
  hace es una decision de quien administra la flota.

  LO QUE PASA AL BORRAR UN PLAN, que hay que decir en pantalla: la llave foranea
  de ordenes_mantencion.plan_id es ON DELETE SET NULL. O sea el historial NO se
  pierde: las ordenes ya registradas siguen ahi, pero quedan sin plan asociado.
  Se pierde el vinculo, no el trabajo. Y el activo deja de tener ese semaforo.

  Por eso el borrado ofrece tambien la alternativa correcta para la mayoria de
  los casos, que es desactivar el plan: deja de calcular semaforo y de aparecer
  como pendiente, y conserva el vinculo con su historial.
*/

export type EstadoPlan = { error?: string; ok?: string };

const texto = (d: FormData, c: string) => String(d.get(c) ?? "").trim();

/*
  Los intervalos son opcionales por separado pero obligatorios en conjunto: la
  base exige al menos uno con el check planes_al_menos_un_intervalo. Un campo
  vacio tiene que llegar como null y no como cero, porque cero rompe el otro
  check, el de intervalos positivos, y el mensaje que devolveria la base no le
  dice nada a nadie.
*/
function numeroOpcional(d: FormData, c: string): number | null | "invalido" {
  const bruto = texto(d, c);
  if (bruto === "") return null;
  const n = Number(bruto);
  if (!Number.isFinite(n)) return "invalido";
  return n;
}

function traduce(codigo: string | undefined, mensaje: string): string {
  if (codigo === "42501") return "Tu rol no tiene permiso para administrar planes.";
  if (codigo === "23514") {
    if (mensaje.includes("al_menos_un_intervalo")) {
      return "El plan necesita al menos un intervalo: cada cuántos días, cada cuántas horas de uso, o los dos.";
    }
    if (mensaje.includes("intervalos_positivos")) {
      return "Los intervalos tienen que ser mayores que cero. Deja el campo vacío si ese intervalo no aplica.";
    }
    if (mensaje.includes("nombre_no_vacio")) {
      return "El plan necesita un nombre.";
    }
    return "Los datos no cumplen una regla de la base.";
  }
  if (codigo === "23503") {
    return "El activo de este plan ya no existe.";
  }
  console.error("Error de base en un plan de mantención:", mensaje);
  return "No pude guardar el plan. Revisa los datos e intenta de nuevo.";
}

function camposDesde(datos: FormData):
  | { ok: true; campos: { nombre: string; intervalo_dias: number | null; intervalo_horas: number | null; descripcion_tareas: string | null; activo: boolean } }
  | { ok: false; error: string } {
  const nombre = texto(datos, "nombre");
  if (!nombre) return { ok: false, error: "El plan necesita un nombre." };

  const dias = numeroOpcional(datos, "intervalo_dias");
  const horas = numeroOpcional(datos, "intervalo_horas");
  if (dias === "invalido" || horas === "invalido") {
    return { ok: false, error: "Los intervalos tienen que ser números." };
  }
  if (dias === null && horas === null) {
    return {
      ok: false,
      error:
        "Indica al menos un intervalo: cada cuántos días, cada cuántas horas de uso, o los dos.",
    };
  }
  if ((dias !== null && dias <= 0) || (horas !== null && horas <= 0)) {
    return {
      ok: false,
      error: "Los intervalos tienen que ser mayores que cero. Deja vacío el que no aplique.",
    };
  }

  const descripcion = texto(datos, "descripcion_tareas");

  return {
    ok: true,
    campos: {
      nombre,
      intervalo_dias: dias,
      intervalo_horas: horas,
      descripcion_tareas: descripcion.length > 0 ? descripcion : null,
      activo: texto(datos, "activo") === "1",
    },
  };
}

/* Se revalidan las dos rutas que cambian de contenido: la ficha del activo y el
   resumen, cuyo semaforo depende de los planes que existan. */
function revalida(activoId: string) {
  revalidatePath(`/admin/activos/${activoId}`);
  revalidatePath("/admin/activos");
  revalidatePath("/admin");
}

export async function crearPlan(_p: EstadoPlan, datos: FormData): Promise<EstadoPlan> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const activoId = texto(datos, "activo_id");
  if (!activoId) return { error: "Falta el activo al que pertenece el plan." };

  const resultado = camposDesde(datos);
  if (!resultado.ok) return { error: resultado.error };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("planes_mantencion")
    .insert({ activo_id: activoId, ...resultado.campos });

  if (error) return { error: traduce(error.code, error.message) };

  revalida(activoId);
  return { ok: `Plan "${resultado.campos.nombre}" creado.` };
}

export async function actualizarPlan(_p: EstadoPlan, datos: FormData): Promise<EstadoPlan> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const id = texto(datos, "id");
  const activoId = texto(datos, "activo_id");
  if (!id) return { error: "Falta el plan." };

  const resultado = camposDesde(datos);
  if (!resultado.ok) return { error: resultado.error };

  const supabase = await crearClienteServidor();
  /*
    Se filtra tambien por activo_id. Sin eso, un id de plan de otra maquina
    puesto a mano en el formulario editaria el plan ajeno: RLS solo comprueba
    que quien escribe sea administrador, no que el plan pertenezca a la maquina
    que se esta mirando.
  */
  const { data, error } = await supabase
    .from("planes_mantencion")
    .update(resultado.campos)
    .eq("id", id)
    .eq("activo_id", activoId)
    .select("id");

  if (error) return { error: traduce(error.code, error.message) };
  if (!data || data.length === 0) {
    return { error: "Ese plan ya no existe o no pertenece a esta máquina." };
  }

  revalida(activoId);
  return { ok: "Plan actualizado." };
}

/*
  Desactivar en vez de borrar. Es la opcion correcta para casi todos los casos y
  por eso va antes en la pantalla: el plan deja de calcular semaforo y de
  aparecer como pendiente, y conserva el vinculo con su historial de ordenes.
*/
export async function alternarPlanActivo(_p: EstadoPlan, datos: FormData): Promise<EstadoPlan> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const id = texto(datos, "id");
  const activoId = texto(datos, "activo_id");
  const activar = texto(datos, "activar") === "1";
  if (!id) return { error: "Falta el plan." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("planes_mantencion")
    .update({ activo: activar })
    .eq("id", id)
    .eq("activo_id", activoId)
    .select("nombre");

  if (error) return { error: traduce(error.code, error.message) };
  if (!data || data.length === 0) {
    return { error: "Ese plan ya no existe o no pertenece a esta máquina." };
  }

  revalida(activoId);
  return {
    ok: activar
      ? `Plan "${data[0].nombre}" reactivado: vuelve a calcular semáforo.`
      : `Plan "${data[0].nombre}" desactivado: deja de calcular semáforo y su historial se conserva.`,
  };
}

/*
  Borrado definitivo. Pide escribir el nombre del plan, por la misma razon que
  el borrado de un activo pide su codigo: obliga a mirar cual se esta borrando.
  En una maquina con cinco planes, apretar la fila equivocada es facil.
*/
export async function eliminarPlan(_p: EstadoPlan, datos: FormData): Promise<EstadoPlan> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const id = texto(datos, "id");
  const activoId = texto(datos, "activo_id");
  const confirmacion = texto(datos, "confirmacion");
  const esperado = texto(datos, "nombre_esperado");

  if (!id) return { error: "Falta el plan." };
  if (confirmacion !== esperado) {
    return { error: `Para borrar, escribe exactamente el nombre del plan: ${esperado}` };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("planes_mantencion")
    .delete()
    .eq("id", id)
    .eq("activo_id", activoId)
    .select("nombre");

  if (error) return { error: traduce(error.code, error.message) };
  if (!data || data.length === 0) {
    return { error: "Ese plan ya no existe o no pertenece a esta máquina." };
  }

  revalida(activoId);
  return {
    ok: `Plan "${data[0].nombre}" borrado. Las mantenciones ya registradas se conservan, sin plan asociado.`,
  };
}
