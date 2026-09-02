"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

/*
  Cerrar sesion no lleva guarda de rol: cualquiera con o sin sesion puede
  pedirlo y el resultado es el mismo, quedar sin sesion. Es la unica accion del
  panel que no necesita requiereRol.
*/
export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
