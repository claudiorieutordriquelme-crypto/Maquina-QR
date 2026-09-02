import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/*
  Proxy. En Next 16 esto se llamaba middleware.ts: mismo comportamiento, otro
  nombre y otro nombre de export. Corre siempre en runtime nodejs y NO acepta
  `export const runtime`; ponerlo lanza error de build.

  Hace dos cosas, y solo dos:

  1. Refresca la cookie de sesion. Es el unico lugar del stack que tiene una
     respuesta HTTP donde escribir cookies antes de que se renderice la pagina,
     asi que si esto no corre, la sesion expira sola y el usuario se cae del
     panel sin explicacion.

  2. Un chequeo optimista de navegacion: si no hay sesion y la ruta es de
     /admin, redirige a /login.

  Lo que NO es: la capa de autorizacion. Eso son las politicas RLS mas la
  verificacion de rol dentro de cada Server Action, en src/lib/auth.ts. La razon
  es concreta: un matcher que excluye una ruta tambien excluye las Server
  Functions invocadas desde esa ruta, asi que apoyar la seguridad aca deja un
  agujero del tamano de una expresion regular.
*/
export async function proxy(request: NextRequest) {
  const respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesAEscribir, cabeceras) {
          for (const { name, value, options } of cookiesAEscribir) {
            // En la peticion para que el resto del pipeline vea la cookie nueva,
            // y en la respuesta para que el navegador se la quede.
            request.cookies.set(name, value);
            respuesta.cookies.set(name, value, options);
          }
          for (const [clave, valor] of Object.entries(cabeceras ?? {})) {
            respuesta.headers.set(clave, valor);
          }
        },
      },
    },
  );

  // getUser y no getSession: valida el token contra el servidor de Auth. Es la
  // llamada que dispara el refresco cuando el access token esta por vencer.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;

  if (!user && ruta.startsWith("/admin")) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "";
    // Se guarda a donde queria ir para devolverlo ahi despues del login.
    destino.searchParams.set("volver", ruta);
    return NextResponse.redirect(destino);
  }

  if (user && ruta === "/login") {
    const destino = request.nextUrl.clone();
    destino.pathname = "/admin";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return respuesta;
}

export const config = {
  /*
    Se excluyen los archivos estaticos, que no tienen sesion que refrescar, y
    tambien /a/, la ficha publica.

    Excluir /a/ es una decision con fundamento y no un descuido: esa ruta se
    abre sin login, en terreno y con senal mala, y hacerla pasar por aca le
    agregaria una validacion de token contra el servidor de Auth en cada
    escaneo, latencia pura para una pagina que no tiene sesion.

    La condicion que lo hace seguro es que /a/ no invoca ninguna Server Function.
    Si algun dia se le agrega una, hay que sacar esta exclusion, porque el
    matcher tambien la excluiria a ella.
  */
  matcher: [
    "/((?!a/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
