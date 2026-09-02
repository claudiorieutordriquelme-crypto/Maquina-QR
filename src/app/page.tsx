/*
  Landing minima. El acceso al panel usa un ancla y no next/link a proposito:
  Next 16 tipa las rutas, y /login recien existe en la Etapa 5, asi que un
  <Link href="/login"> hoy rompe el typecheck. Cuando la ruta exista se cambia
  por <Link> para tener prefetch.
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
        <a
          href="/login"
          className="inline-flex items-center rounded-md bg-primario px-5 py-3 text-base font-semibold text-blanco transition-opacity hover:opacity-90"
        >
          Acceder al panel
        </a>
        <p className="mt-3 text-sm text-gris-500">
          El panel privado permite cargar activos, registrar mantenciones y
          gestionar repuestos y proveedores.
        </p>
      </div>
    </main>
  );
}
