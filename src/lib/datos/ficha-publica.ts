import { cache } from "react";
import { headers } from "next/headers";
import { crearClientePublico } from "@/lib/supabase/server";
import type { ResultadoFicha } from "@/lib/tipos";

/*
  Acceso a la ficha publica.

  Nunca se hace select directo a una tabla desde esta ruta: la ficha sale
  exclusivamente por public.get_ficha_publica, que es SECURITY DEFINER con
  search_path fijado y es la unica funcion que el rol anon puede ejecutar. El
  filtro de costos ocurre dentro de esa funcion, asi que los montos no viajan en
  la respuesta de red cuando la bandera esta apagada.
*/

/*
  Se acepta cualquier formato UUID y no solo v4. Los tokens los genera
  gen_random_uuid(), que produce v4, pero una carga manual o una migracion futura
  podria dejar otro variante y no tiene sentido devolver 404 por eso. Lo que
  importa es no pasarle a Postgres un texto que no sea UUID, porque revienta con
  invalid input syntax en vez de responder null.
*/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esTokenConFormatoValido(token: string): boolean {
  return UUID.test(token);
}

/*
  Clave del rate limit. Se prefiere x-real-ip porque en Vercel la pone la
  plataforma; x-forwarded-for puede venir con una cadena de proxies y su primer
  valor es el que corresponde al cliente.

  Advertencia deliberada: estas cabeceras son falsificables si alguien pega
  directo al RPC de Supabase saltandose esta ruta. El limite de aca frena abuso
  volumetrico casual, no a alguien decidido. El control real contra enumeracion
  son los 122 bits de entropia del qr_token, y el punto donde el limite se puede
  imponer de verdad es el borde.
*/
async function claveRateLimit(): Promise<string | null> {
  const h = await headers();

  const real = h.get("x-real-ip");
  if (real && real.trim()) return real.trim();

  for (const nombre of ["x-vercel-forwarded-for", "x-forwarded-for"]) {
    const valor = h.get(nombre);
    const primera = valor?.split(",")[0]?.trim();
    if (primera) return primera;
  }

  return null;
}

/*
  cache() de React memoriza por request y por argumentos. Importa: la pagina y
  generateMetadata necesitan la misma ficha, y sin esto serian dos llamadas a la
  base y dos hits del rate limit por cada escaneo.
*/
const consultaFicha = cache(async (token: string, clave: string | null): Promise<ResultadoFicha> => {
  const supabase = crearClientePublico();

  const { data, error } = await supabase.rpc("get_ficha_publica", {
    p_token: token,
    p_clave: clave,
  });

  if (error) {
    // No se registra el token: es el secreto que protege la ficha y los logs de
    // la plataforma son un lugar mas donde podria quedar.
    console.error("get_ficha_publica fallo:", error.message);
    throw new Error("No se pudo consultar la ficha del activo.");
  }

  return (data ?? null) as ResultadoFicha;
});

export async function obtenerFichaPublica(token: string): Promise<ResultadoFicha> {
  if (!esTokenConFormatoValido(token)) return null;
  return consultaFicha(token, await claveRateLimit());
}
