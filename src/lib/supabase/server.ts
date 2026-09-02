import { createClient } from "@supabase/supabase-js";
import { anonKeySupabase, urlSupabase } from "@/lib/env";

/*
  Cliente publico, para la ruta que se abre al escanear el QR.

  No lleva sesion ni cookies: la ficha se sirve sin login y la unica funcion que
  el rol anon puede ejecutar es get_ficha_publica. Por eso no se usa
  createServerClient de @supabase/ssr aca, que existe para leer y refrescar la
  sesion desde cookies. El cliente con sesion llega en la Etapa 5, en este mismo
  archivo, cuando exista /login.

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
