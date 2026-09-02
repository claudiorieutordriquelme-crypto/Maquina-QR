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

/*
  Cuenta de demostracion que se publica en /login para que cualquiera pueda
  entrar a mirar.

  Vive en variables de entorno y no en el codigo por la regla de cero
  credenciales en el repositorio, que menciona explicitamente las contraseñas de
  demostracion. Hay una tension evidente: es una credencial cuyo proposito es
  estar impresa en una pagina publica, asi que no tiene confidencialidad que
  proteger. Igual se respeta la regla, porque el dia que alguien decida rotarla
  o apagar la demo, se hace en Vercel y no en un commit.

  Sin el prefijo NEXT_PUBLIC_ a proposito: se lee en el servidor, se imprime en
  el HTML deliberadamente, pero no viaja en el bundle del cliente.

  Debe ser SIEMPRE una cuenta de solo lectura. Publicar una con permiso de
  escritura equivale a dejar la base abierta a internet.
*/
export type CredencialesDemo = { email: string; password: string };

export function credencialesDemo(): CredencialesDemo | null {
  const email = process.env.DEMO_EMAIL?.trim();
  const password = process.env.DEMO_PASSWORD?.trim();
  if (!email || !password) return null;
  return { email, password };
}
