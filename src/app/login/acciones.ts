"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoLogin = { error?: string };

/*
  Solo se permite volver a rutas internas del panel. Sin esta validacion,
  ?volver=https://otro-sitio convierte el login en un redirector abierto, que es
  material clasico de phishing: el link se ve legitimo porque el dominio es el
  nuestro.
*/
function destinoSeguro(volver: unknown): string {
  const v = typeof volver === "string" ? volver : "";
  return v.startsWith("/admin") && !v.startsWith("//") ? v : "/admin";
}

export async function iniciarSesion(
  _estadoPrevio: EstadoLogin,
  datos: FormData,
): Promise<EstadoLogin> {
  const email = String(datos.get("email") ?? "").trim();
  const password = String(datos.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y tu contraseña." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    /*
      Mensaje unico para credenciales malas, cuenta inexistente y correo sin
      confirmar. Distinguirlos le permite a cualquiera averiguar que correos
      tienen cuenta en el sistema probando de a uno.
    */
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect(destinoSeguro(datos.get("volver")));
}
