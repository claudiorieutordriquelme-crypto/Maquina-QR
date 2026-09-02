/*
  Lectura y validacion de variables de entorno.

  Se leen con funciones y no como constantes de modulo a proposito: una
  constante que lanza al importarse revienta durante `next build` cuando las
  variables todavia no estan cargadas en Vercel, y el error aparece en un lugar
  que no tiene nada que ver con la causa. Asi el build pasa y la falla ocurre en
  la ruta que de verdad necesita la variable, con un mensaje que dice cual falta.
*/

function requerida(nombre: string, valor: string | undefined): string {
  if (!valor || valor.trim().length === 0) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. En local va en .env.local, en Vercel en Environment Variables.`,
    );
  }
  return valor.trim();
}

export function urlSupabase(): string {
  return requerida("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function anonKeySupabase(): string {
  return requerida("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/*
  Base de todos los QR impresos. Si el dominio cambia despues de imprimir una
  flota, las etiquetas quedan apuntando al dominio viejo y hay que reimprimirlas.
  Por eso no tiene valor por defecto: es mejor fallar fuerte que generar 80
  etiquetas contra localhost.
*/
export function urlApp(): string {
  return requerida("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL);
}
