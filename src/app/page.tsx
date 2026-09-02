import Link from "next/link";

/*
  Landing minima.

  El acceso al panel es un <Link> y no un ancla porque Next 16 tipa las rutas:
  esto compila solo porque /login existe de verdad, asi que el typecheck es la
  garantia de que el boton no lleva a un 404. Ademas da prefetch.
*/
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-semibold tracking-widest text-primario uppercase">
          Mantención de maquinaria
        </p>
        <h1 className="text-4xl font-bold text-gris-900 sm:text-5xl">
          Máquina QR
        </h1>
        <p className="max-w-prose text-lg text-gris-600">
          Cada máquina lleva un código QR pegado. Se escanea con la cámara del
          teléfono y muestra la ficha del activo: identificación, historial de
          mantenciones y cuándo vence la próxima. Sin login y sin instalar nada.
        </p>
      </div>

      <div className="border-t border-gris-200 pt-8">
        <Link
          href="/login"
          className="inline-flex items-center rounded-md bg-primario px-5 py-3 text-base font-semibold text-blanco transition-opacity hover:opacity-90"
        >
          Entrar al panel
        </Link>
        <p className="mt-3 max-w-prose text-sm text-gris-500">
          En la pantalla de acceso hay una cuenta de demostración de solo
          lectura para recorrer el panel. Por ahora muestra el resumen del
          estado de mantención de la flota; la carga de activos, el registro de
          mantenciones y los maestros están en construcción.
        </p>
      </div>
    </main>
  );
}
