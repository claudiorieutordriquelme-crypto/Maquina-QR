"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISOS, requiereRol } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoFormulario = { error?: string; ok?: string; campo?: string };

const ESTADOS = ["operativo", "en_mantencion", "fuera_servicio", "dado_de_baja"] as const;

function texto(datos: FormData, campo: string): string {
  return String(datos.get(campo) ?? "").trim();
}

function opcional(datos: FormData, campo: string): string | null {
  const v = texto(datos, campo);
  return v.length > 0 ? v : null;
}

function numero(datos: FormData, campo: string): number | null {
  const v = texto(datos, campo);
  if (v.length === 0) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/*
  Alta de activo.

  requiereRol es la autorizacion real de esta accion, junto con la politica
  activos_admin que exige es_admin() en la base. No se confia en que el proxy
  haya redirigido ni en que el boton estuviera oculto: una Server Action es un
  endpoint HTTP y se puede invocar directamente.

  El qr_token no se recibe del formulario ni se genera aca: lo pone la base con
  gen_random_uuid() como default. Que lo genere el cliente abriria la puerta a
  tokens predecibles o repetidos.
*/
export async function crearActivo(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const nombre = texto(datos, "nombre");
  const codigo_interno = texto(datos, "codigo_interno");
  const tipo_codigo = texto(datos, "tipo_codigo");
  const estado = texto(datos, "estado");

  if (!nombre) return { error: "El nombre es obligatorio.", campo: "nombre" };
  if (!codigo_interno) return { error: "El código interno es obligatorio.", campo: "codigo_interno" };
  if (!tipo_codigo) return { error: "Elige un tipo de activo.", campo: "tipo_codigo" };
  if (!ESTADOS.includes(estado as (typeof ESTADOS)[number])) {
    return { error: "Estado no válido.", campo: "estado" };
  }

  const supabase = await crearClienteServidor();

  const { data, error } = await supabase
    .from("activos")
    .insert({
      nombre,
      codigo_interno,
      tipo_codigo,
      estado,
      patente: opcional(datos, "patente"),
      numero_serie: opcional(datos, "numero_serie"),
      numero_chasis: opcional(datos, "numero_chasis"),
      marca: opcional(datos, "marca"),
      modelo: opcional(datos, "modelo"),
      anio: numero(datos, "anio"),
      ubicacion: opcional(datos, "ubicacion"),
      horometro_actual: numero(datos, "horometro_actual"),
      kilometraje_actual: numero(datos, "kilometraje_actual"),
      fecha_adquisicion: opcional(datos, "fecha_adquisicion"),
      valor_adquisicion: numero(datos, "valor_adquisicion"),
      notas: opcional(datos, "notas"),
    })
    .select("id")
    .single();

  if (error) {
    /*
      23505 es violacion de unicidad. Los constraints unicos de activos son
      codigo_interno y patente, y conviene decir cual choco en vez de mostrar el
      mensaje de Postgres, que menciona el nombre del indice y no le dice nada a
      quien esta cargando maquinaria.
    */
    if (error.code === "23505") {
      const cual = error.message.includes("patente") ? "esa patente" : "ese código interno";
      return { error: `Ya existe un activo con ${cual}.` };
    }
    // 42501 es violacion de RLS: la base rechazo la escritura.
    if (error.code === "42501") {
      return { error: "Tu rol no tiene permiso para crear activos." };
    }
    console.error("No pude crear el activo:", error.message);
    return { error: "No pude guardar el activo. Revisa los datos e intenta de nuevo." };
  }

  revalidatePath("/admin/activos");
  revalidatePath("/admin");

  // Se va directo a la etiqueta: cargar un activo y no imprimir su QR deja el
  // trabajo a medias, porque la maquina queda sin identificar en terreno.
  redirect(`/admin/activos/${data.id}/qr`);
}

/*
  Edicion de activo. Se excluyen dos campos a proposito:

  - qr_token, porque cambiarlo invalida todas las etiquetas ya impresas de esa
    maquina. Si algun dia hace falta rotarlo, tiene que ser una accion aparte,
    con su propia advertencia y su reimpresion.
  - horometro_actual y kilometraje_actual siguen siendo editables aca, pero lo
    normal es que los mueva el trigger al registrar una lectura o una orden. Se
    dejan a mano porque una carga inicial mal tipeada hay que poder corregirla.
*/
export async function actualizarActivo(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const id = texto(datos, "id");
  const nombre = texto(datos, "nombre");
  const codigo_interno = texto(datos, "codigo_interno");
  const tipo_codigo = texto(datos, "tipo_codigo");
  const estado = texto(datos, "estado");

  if (!id) return { error: "Falta el identificador del activo." };
  if (!nombre) return { error: "El nombre es obligatorio.", campo: "nombre" };
  if (!codigo_interno) return { error: "El código interno es obligatorio.", campo: "codigo_interno" };
  if (!tipo_codigo) return { error: "Elige un tipo de activo.", campo: "tipo_codigo" };
  if (!ESTADOS.includes(estado as (typeof ESTADOS)[number])) {
    return { error: "Estado no válido.", campo: "estado" };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("activos")
    .update({
      nombre,
      codigo_interno,
      tipo_codigo,
      estado,
      patente: opcional(datos, "patente"),
      numero_serie: opcional(datos, "numero_serie"),
      numero_chasis: opcional(datos, "numero_chasis"),
      marca: opcional(datos, "marca"),
      modelo: opcional(datos, "modelo"),
      anio: numero(datos, "anio"),
      ubicacion: opcional(datos, "ubicacion"),
      horometro_actual: numero(datos, "horometro_actual"),
      kilometraje_actual: numero(datos, "kilometraje_actual"),
      fecha_adquisicion: opcional(datos, "fecha_adquisicion"),
      valor_adquisicion: numero(datos, "valor_adquisicion"),
      notas: opcional(datos, "notas"),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      const cual = error.message.includes("patente") ? "esa patente" : "ese código interno";
      return { error: `Ya existe otro activo con ${cual}.` };
    }
    if (error.code === "42501") return { error: "Tu rol no tiene permiso para editar activos." };
    console.error("No pude actualizar el activo:", error.message);
    return { error: "No pude guardar los cambios. Revisa los datos e intenta de nuevo." };
  }

  revalidatePath(`/admin/activos/${id}`);
  revalidatePath("/admin/activos");
  revalidatePath("/admin");
  return { ok: "Cambios guardados." };
}

/*
  Borrado de activo.

  Pide escribir el codigo interno para confirmar. No es un adorno: un borrado se
  lleva en cascada los planes de mantencion y todas las lecturas de horometro de
  esa maquina, y eso no tiene vuelta atras desde la interfaz.

  La base pone el limite duro que de verdad protege el historial: la foreign key
  de ordenes_mantencion es RESTRICT, asi que un activo con mantenciones
  registradas no se puede borrar por ningun camino. Para una maquina con
  historial, lo correcto es cambiarla al estado "dado de baja", que ademas hace
  que su ficha publica responda 404.
*/
export async function eliminarActivo(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const id = texto(datos, "id");
  const confirmacion = texto(datos, "confirmacion");
  const codigoEsperado = texto(datos, "codigo_esperado");

  if (!id) return { error: "Falta el identificador del activo." };
  if (confirmacion !== codigoEsperado) {
    return {
      error: `Para borrar, escribe exactamente el código interno: ${codigoEsperado}`,
      campo: "confirmacion",
    };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("activos").delete().eq("id", id);

  if (error) {
    // 23503 es violacion de foreign key: la orden de mantencion lo esta
    // deteniendo, que es el comportamiento correcto y hay que explicarlo.
    if (error.code === "23503") {
      return {
        error:
          "Este activo tiene mantenciones registradas y la base impide borrarlo, para no perder el historial. Cámbialo al estado “dado de baja”: deja de aparecer en los listados y su ficha pública responde 404.",
      };
    }
    if (error.code === "42501") return { error: "Tu rol no tiene permiso para borrar activos." };
    console.error("No pude borrar el activo:", error.message);
    return { error: "No pude borrar el activo." };
  }

  revalidatePath("/admin/activos");
  revalidatePath("/admin");
  redirect("/admin/activos");
}
