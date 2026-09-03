import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaPublicaVista } from "@/components/ficha-publica-vista";
import { obtenerFichaPublica } from "@/lib/datos/ficha-publica";
import { esFicha, esRateLimit } from "@/lib/tipos";

/*
  Ficha publica. Se abre al escanear el QR pegado en la maquina, sin login.

  force-dynamic y no cache: el semaforo depende de CURRENT_DATE y del horometro
  del momento. Una ficha cacheada por horas puede decirle a un operador que la
  maquina esta al dia cuando ya vencio. Sigue siendo valido en Next 16 porque
  cacheComponents esta desactivado en next.config.ts.
*/
export const dynamic = "force-dynamic";

/*
  noindex es obligatorio aca, no una preferencia. La URL contiene el qr_token, o
  sea el secreto que protege la ficha. Si un buscador indexa una de estas
  paginas, el token queda publicado para siempre y el activo pierde su unica
  proteccion. No se usa Disallow en robots.txt para esto: eso impide el rastreo,
  y un rastreador que no entra tampoco lee el noindex, asi que la URL puede
  aparecer igual si alguien la enlaza.
*/
const SIN_INDEXAR: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const resultado = await obtenerFichaPublica(token);

  if (!esFicha(resultado)) {
    return { title: "Activo no encontrado", robots: SIN_INDEXAR };
  }

  const { activo } = resultado;
  const identificacion = [activo.codigo_interno, activo.patente].filter(Boolean).join(" · ");

  return {
    // Importa para compartir el link por WhatsApp: el titulo es lo que se ve en
    // la previsualizacion, y ahi el codigo de flota vale mas que el nombre.
    title: `${activo.nombre} · ${identificacion}`,
    description: [activo.tipo, activo.marca, activo.modelo, activo.ubicacion]
      .filter(Boolean)
      .join(" · "),
    robots: SIN_INDEXAR,
  };
}

function LimiteAlcanzado() {
  return (
    <div className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-2xl font-bold text-gris-900">Demasiadas consultas</h1>
      <p className="mt-3 text-base text-gris-600">
        Se alcanzó el límite de consultas desde esta conexión. Espera un minuto y vuelve a escanear
        el código.
      </p>
    </div>
  );
}

export default async function FichaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resultado = await obtenerFichaPublica(token);

  if (esRateLimit(resultado)) {
    return (
      <main className="min-h-dvh">
        <LimiteAlcanzado />
      </main>
    );
  }

  /*
    Token con formato invalido, token inexistente y activo dado de baja caen en
    el mismo 404. Es deliberado: responder distinto permitiria averiguar si un
    token existe sin ver la ficha.
  */
  if (!esFicha(resultado)) {
    notFound();
  }

  return (
    <main className="min-h-dvh">
      <FichaPublicaVista ficha={resultado} token={token} />
    </main>
  );
}
