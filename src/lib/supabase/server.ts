import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { anonKeySupabase, urlSupabase } from "@/lib/env";

/*
  Cliente publico, para la ruta que se abre al escanear el QR.

  No lleva sesion ni cookies: la ficha se sirve sin login y la unica funcion que
  el rol anon puede ejecutar es get_ficha_publica. Por eso no usa
  createServerClient, que existe para leer y refrescar la sesion desde cookies.

  persistSession y autoRefreshToken van en false porque en el servidor no hay
  donde persistir nada y un refresco automatico en un Server Component solo
  agrega latencia y un timer que nadie limpia.
*/
export function crearClientePublico() {
  return createClient(urlSupabase(), anonKeySupabase(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/*
  Cliente con sesion, para todo lo que vive detras de /admin.

  Usa la anon key, igual que el navegador: lo que decide que puede leer y
  escribir cada persona no es la clave, son las politicas RLS evaluadas contra
  el JWT que viaja en la cookie. Ese es el punto de todo el diseno.

  cookies() es asincrono desde Next 15, de ahi el await. setAll recibe un
  segundo argumento con cabeceras desde @supabase/ssr 0.12: no se pueden aplicar
  desde un Server Component, y no hace falta, porque el refresco de sesion real
  ocurre en src/proxy.ts, que si tiene una respuesta donde escribirlas.
*/
export async function crearClienteServidor() {
  const almacen = await cookies();

  return createServerClient(urlSupabase(), anonKeySupabase(), {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(cookiesAEscribir) {
        try {
          for (const { name, value, options } of cookiesAEscribir) {
            almacen.set(name, value, options);
          }
        } catch {
          /*
            Un Server Component no puede escribir cookies y Next lanza si se
            intenta. No es un error que haya que propagar: el proxy ya dejo la
            cookie fresca en la respuesta antes de que esta pagina se renderice.
          */
        }
      },
    },
  });
}
