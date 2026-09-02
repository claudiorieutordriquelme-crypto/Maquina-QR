/*
  Landing minima.

  El acceso al panel todavia no es un enlace: /login recien existe en la Etapa 5
  y un boton que responde 404 es peor que un boton que dice que no esta listo,
  sobre todo en una URL que se comparte para revisar el avance. Cuando la ruta
  exista se cambia por <Link href="/login">, que ademas da prefetch. Se usara
  <Link> y no un ancla porque Next 16 tipa las rutas y recien ahi compila.
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
        <p className="inline-flex items-center rounded-md border border-gris-300 px-5 py-3 text-base font-semibold text-gris-500">
          Panel privado: en construcción
        </p>
        <p className="mt-3 max-w-prose text-sm text-gris-500">
          Permitirá cargar activos, registrar mantenciones, adjuntar facturas y
          gestionar el maestro de repuestos y proveedores. La ficha que se abre
          al escanear un código QR ya está operativa.
        </p>
      </div>
    </main>
  );
}
