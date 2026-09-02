import Link from "next/link";
import { BotonDemo } from "@/components/boton-demo";

/*
  Landing minima.

  El boton de demostracion se renderiza siempre, sin consultar antes si la demo
  esta habilitada. Es a proposito: consultarlo obligaria a que esta pagina deje
  de ser estatica y haga una llamada a la base en cada visita, para decidir el
  texto de un boton. Si la demo estuviera apagada, el clic devuelve el mensaje
  de que no esta disponible, que es un estado raro y con explicacion clara.

  El acceso al panel es un <Link> y no un ancla porque Next 16 tipa las rutas:
  esto compila solo porque /login existe de verdad, asi que el typecheck es la
  garantia de que el boton no lleva a un 404.
*/
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-semibold tracking-widest text-primario uppercase">
          Mantención de maquinaria
        </p>
        <h1 className="text-4xl font-bold text-gris-900 sm:text-5xl">Máquina QR</h1>
        <p className="max-w-prose text-lg text-gris-600">
          Cada máquina lleva un código QR pegado. Se escanea con la cámara del
          teléfono y muestra la ficha del activo: identificación, historial de
          mantenciones y cuándo vence la próxima. Sin login y sin instalar nada.
        </p>
      </div>

      <div className="border-t border-gris-200 pt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <BotonDemo />
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md border border-gris-300 px-5 py-3 text-base font-semibold text-gris-800 transition-colors hover:border-gris-500"
          >
            Entrar con mi cuenta
          </Link>
        </div>

        <p className="mt-4 max-w-prose text-sm text-gris-500">
          La cuenta de demostración es de solo lectura: permite recorrer el panel
          sin poder modificar ni borrar nada. Por ahora el panel muestra el
          resumen del estado de mantención de la flota; la carga de activos, el
          registro de mantenciones y los maestros están en construcción.
        </p>
      </div>
    </main>
  );
}
