"use server";

import { revalidatePath } from "next/cache";
import { PERMISOS, requiereRol } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoProveedor = { error?: string; ok?: string };

const texto = (d: FormData, c: string) => String(d.get(c) ?? "").trim();
const opcional = (d: FormData, c: string) => (texto(d, c).length > 0 ? texto(d, c) : null);

/*
  El RUT lo valida la base con public.valida_rut, que aplica modulo 11, y un
  trigger lo normaliza antes de guardarlo. Por eso aca no se valida ni se
  formatea: hacerlo duplicaria la regla, y dos implementaciones de la misma
  regla terminan discrepando. Lo que si se hace es traducir el rechazo, porque
  "violates check constraint proveedores_rut_valido" no le dice nada a nadie.
*/
function traduce(codigo: string | undefined, mensaje: string): string {
  if (codigo === "42501") return "Tu rol no tiene permiso para esta operación.";
  if (codigo === "23505") return "Ya existe un proveedor con ese RUT.";
  if (codigo === "23514") {
    if (mensaje.includes("rut")) {
      return "El RUT no es válido: el dígito verificador no cuadra con el módulo 11.";
    }
    return "Los datos no cumplen una regla de la base.";
  }
  console.error("Error de base:", mensaje);
  return "No pude guardar. Revisa los datos e intenta de nuevo.";
}

function camposDesde(datos: FormData) {
  return {
    nombre: texto(datos, "nombre"),
    rut: opcional(datos, "rut"),
    giro: opcional(datos, "giro"),
    contacto_nombre: opcional(datos, "contacto_nombre"),
    contacto_email: opcional(datos, "contacto_email"),
    contacto_telefono: opcional(datos, "contacto_telefono"),
    direccion: opcional(datos, "direccion"),
    notas: opcional(datos, "notas"),
  };
}

export async function crearProveedor(
  _p: EstadoProveedor,
  datos: FormData,
): Promise<EstadoProveedor> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const campos = camposDesde(datos);
  if (!campos.nombre) return { error: "El nombre es obligatorio." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("proveedores").insert(campos);
  if (error) return { error: traduce(error.code, error.message) };

  revalidatePath("/admin/proveedores");
  return { ok: `Proveedor ${campos.nombre} creado.` };
}

export async function actualizarProveedor(
  _p: EstadoProveedor,
  datos: FormData,
): Promise<EstadoProveedor> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const id = texto(datos, "id");
  if (!id) return { error: "Falta el proveedor." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("proveedores")
    .update({ ...camposDesde(datos), activo: texto(datos, "activo") === "1" })
    .eq("id", id);

  if (error) return { error: traduce(error.code, error.message) };

  revalidatePath("/admin/proveedores");
  return { ok: "Proveedor actualizado." };
}
