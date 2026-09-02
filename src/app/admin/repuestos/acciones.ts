"use server";

import { revalidatePath } from "next/cache";
import { PERMISOS, requiereRol } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoMaestro = { error?: string; ok?: string };

const texto = (d: FormData, c: string) => String(d.get(c) ?? "").trim();
const opcional = (d: FormData, c: string) => (texto(d, c).length > 0 ? texto(d, c) : null);
const numero = (d: FormData, c: string) => {
  const v = texto(d, c);
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function traduce(codigo: string | undefined, mensaje: string): string {
  if (codigo === "42501") return "Tu rol no tiene permiso para esta operación.";
  if (codigo === "23505") return "Ya existe un repuesto con ese código.";
  if (codigo === "23514") return "Los datos no cumplen una regla de la base.";
  console.error("Error de base:", mensaje);
  return "No pude guardar. Revisa los datos e intenta de nuevo.";
}

export async function crearRepuesto(_p: EstadoMaestro, datos: FormData): Promise<EstadoMaestro> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const codigo = texto(datos, "codigo");
  const nombre = texto(datos, "nombre");
  if (!codigo) return { error: "El código es obligatorio." };
  if (!nombre) return { error: "El nombre es obligatorio." };

  const supabase = await crearClienteServidor();

  /*
    stock_actual no se recibe del formulario. El saldo lo mantiene el trigger
    desde movimientos_stock, asi que un repuesto nace en cero y su primer saldo
    entra como movimiento de ingreso. Aceptar un stock inicial aca crearia un
    saldo sin respaldo en el libro, y el libro es lo que se audita.
  */
  const { error } = await supabase.from("repuestos").insert({
    codigo,
    nombre,
    descripcion: opcional(datos, "descripcion"),
    unidad_medida: texto(datos, "unidad_medida") || "unidad",
    stock_minimo: numero(datos, "stock_minimo") ?? 0,
    costo_unitario_referencia: numero(datos, "costo_unitario_referencia") ?? 0,
    proveedor_habitual_id: opcional(datos, "proveedor_habitual_id"),
  });

  if (error) return { error: traduce(error.code, error.message) };

  revalidatePath("/admin/repuestos");
  revalidatePath("/admin");
  return { ok: `Repuesto ${codigo} creado. Su stock parte en cero: cárgalo con un ingreso.` };
}

export async function actualizarRepuesto(
  _p: EstadoMaestro,
  datos: FormData,
): Promise<EstadoMaestro> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const id = texto(datos, "id");
  if (!id) return { error: "Falta el repuesto." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("repuestos")
    .update({
      nombre: texto(datos, "nombre"),
      descripcion: opcional(datos, "descripcion"),
      unidad_medida: texto(datos, "unidad_medida") || "unidad",
      stock_minimo: numero(datos, "stock_minimo") ?? 0,
      costo_unitario_referencia: numero(datos, "costo_unitario_referencia") ?? 0,
      proveedor_habitual_id: opcional(datos, "proveedor_habitual_id"),
      activo: texto(datos, "activo") === "1",
    })
    .eq("id", id);

  if (error) return { error: traduce(error.code, error.message) };

  revalidatePath("/admin/repuestos");
  revalidatePath("/admin");
  return { ok: "Repuesto actualizado." };
}

/*
  Movimiento de stock a mano. Solo ingreso y ajuste: el consumo lo genera el
  trigger desde las lineas de orden, y crearlo aca duplicaria el descuento.

  El signo lo decide quien registra: un ajuste puede ser positivo o negativo, y
  un ingreso es siempre positivo. Se valida para que un "ingreso" negativo no
  entre disfrazado.
*/
export async function registrarMovimiento(
  _p: EstadoMaestro,
  datos: FormData,
): Promise<EstadoMaestro> {
  try {
    await requiereRol(PERMISOS.operar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const repuesto_id = texto(datos, "repuesto_id");
  const tipo = texto(datos, "tipo");
  const cantidad = numero(datos, "cantidad");
  const motivo = opcional(datos, "motivo");

  if (!repuesto_id) return { error: "Elige el repuesto." };
  if (tipo !== "ingreso" && tipo !== "ajuste") {
    return { error: "Solo se registran ingresos y ajustes a mano. El consumo lo genera la orden." };
  }
  if (cantidad === null || cantidad === 0) return { error: "La cantidad no puede ser cero." };
  if (tipo === "ingreso" && cantidad < 0) {
    return { error: "Un ingreso no puede ser negativo. Para restar, usa un ajuste." };
  }
  if (!motivo) return { error: "El motivo es obligatorio: este libro se audita." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("movimientos_stock")
    .insert({ repuesto_id, tipo, cantidad, motivo });

  if (error) return { error: traduce(error.code, error.message) };

  revalidatePath("/admin/repuestos");
  revalidatePath("/admin");
  return { ok: "Movimiento registrado. El trigger ya actualizó el saldo." };
}
