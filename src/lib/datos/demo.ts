import { cache } from "react";
import { crearClientePublico } from "@/lib/supabase/server";

/*
  Credenciales de la cuenta de demostracion que se publica en /login.

  Viven en la base, no en el codigo: la regla de cero credenciales en el
  repositorio prohibe explicitamente las contraseñas de demostracion, y aca la
  clave se carga por SQL sin pasar nunca por git. Rotarla es un UPDATE y apagar
  la demo es poner habilitado en false, las dos cosas sin desplegar.

  Las variables de entorno siguen teniendo prioridad, para poder sobrescribir
  sin tocar la base, y DEMO_DESACTIVADO=1 apaga todo de una.

  Sobre el rol de la cuenta publicada: hoy es admin, por decision explicita del
  dueño del proyecto, para que la demo permita crear activos e imprimir sus
  etiquetas. Crear activos exige es_admin() por la politica activos_admin, y no
  hay rol intermedio que lo permita.

  La consecuencia esta asumida y conviene tenerla presente antes de tocar esto:
  la funcion de la base entrega la clave en texto claro a cualquiera que la
  invoque, igual que la pagina la imprime en pantalla, asi que cualquiera con el
  link puede crear, editar y borrar. Los datos son ficticios y supabase/seed.sql
  restaura la demo completa en un comando.

  Si el proyecto deja de ser una demostracion, lo primero es bajar esa cuenta a
  rol lector:
    update public.profiles set rol = 'lector' where email = 'demo@demo.local';
*/

export type CredencialesDemo = { email: string; password: string };

export const obtenerCredencialesDemo = cache(async (): Promise<CredencialesDemo | null> => {
  if (process.env.DEMO_DESACTIVADO === "1") return null;

  const email = process.env.DEMO_EMAIL?.trim();
  const password = process.env.DEMO_PASSWORD?.trim();
  if (email && password) return { email, password };

  const supabase = crearClientePublico();

  // credenciales_demo es la segunda y ultima funcion que el rol anon puede
  // ejecutar, despues de get_ficha_publica. Devuelve null cuando la demo esta
  // deshabilitada o sin clave cargada.
  const { data, error } = await supabase.rpc("credenciales_demo");

  if (error) {
    console.error("No pude leer las credenciales de demostración:", error.message);
    return null;
  }

  const fila = data as CredencialesDemo | null;
  if (!fila?.email || !fila?.password) return null;

  return { email: fila.email, password: fila.password };
});
