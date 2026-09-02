"use server";

import { redirect } from "next/navigation";
import { credencialesDemo } from "@/lib/env";
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

/*
  Entrada directa con la cuenta de demostracion, para no obligar a nadie a
  copiar y tipear una contraseña en un telefono.

  Las credenciales se leen en el servidor y no llegan desde el formulario: si
  vinieran en campos ocultos, cualquiera podria cambiarlas por otras y usar
  esta accion como un segundo login sin el mensaje de error generico.
*/
export async function entrarComoDemo(
  _estadoPrevio: EstadoLogin,
  _datos: FormData,
): Promise<EstadoLogin> {
  const demo = credencialesDemo();

  if (!demo) {
    return { error: "El acceso de demostración no está configurado." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword(demo);

  if (error) {
    console.error("Fallo el acceso de demostración:", error.message);
    return { error: "El acceso de demostración no está disponible por ahora." };
  }

  redirect("/admin");
}
