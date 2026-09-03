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
      /*
        valida_rut devuelve falso por tres motivos distintos: digito verificador
        que no cuadra, largo fuera de 8 o 9 caracteres, o letras en el cuerpo.
        Culpar siempre al digito verificador manda a revisar lo que esta bien.
      */
      return "El RUT no es válido. Revisa que el cuerpo sean solo números, que tenga 7 u 8 dígitos y que el dígito verificador cuadre.";
    }
    if (mensaje.includes("email")) {
      return "El correo de contacto no tiene un formato válido.";
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

/*
  Borrar un proveedor.

  QUE PASA CON EL HISTORIAL: las dos llaves foraneas que apuntan aca son
  ON DELETE SET NULL. ordenes_mantencion.proveedor_id queda en null y
  repuestos.proveedor_habitual_id tambien. O sea el historial NO se pierde: las
  ordenes siguen ahi con su costo, pero dejan de decir quien hizo el trabajo.
  Eso es una perdida de trazabilidad, que es justamente el proposito de este
  sistema, asi que la pantalla ofrece primero la alternativa correcta.

  LA ALTERNATIVA: desactivar. La tabla tiene columna activo y los desplegables
  de seleccion ya la respetan, asi que un proveedor desactivado deja de
  ofrecerse en ordenes nuevas y conserva todo su historial. Para un proveedor
  con el que ya no se trabaja, eso es lo que corresponde. Borrar es para el que
  se cargo por error.

  Se pide escribir el nombre para confirmar, y se informa cuantas ordenes van a
  quedar sin proveedor, porque ese numero es lo que decide si conviene borrar.
*/
export async function eliminarProveedor(
  _p: EstadoProveedor,
  datos: FormData,
): Promise<EstadoProveedor> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const id = texto(datos, "id");
  const confirmacion = texto(datos, "confirmacion");
  const esperado = texto(datos, "nombre_esperado");

  if (!id) return { error: "Falta el proveedor." };
  if (confirmacion !== esperado) {
    return { error: `Para borrar, escribe exactamente el nombre: ${esperado}` };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("proveedores").delete().eq("id", id).select("nombre");

  if (error) return { error: traduce(error.code, error.message) };
  if (!data || data.length === 0) return { error: "Ese proveedor ya no existe." };

  revalidatePath("/admin/proveedores");
  revalidatePath("/admin/mantenciones");
  revalidatePath("/admin/repuestos");
  revalidatePath("/admin/reportes");
  return {
    ok: `Proveedor "${data[0].nombre}" borrado. Las mantenciones que hizo se conservan, pero quedaron sin proveedor asociado.`,
  };
}
