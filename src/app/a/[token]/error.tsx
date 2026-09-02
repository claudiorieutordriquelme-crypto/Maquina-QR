"use client";

/*
  Falla de la consulta a la base en la ficha publica.

  Sin este archivo, si la base no responde, quien escanea el QR ve la pantalla
  de error genérica de Next: un texto en inglés que no dice qué hacer. Esta
  pantalla se lee de pie en un galpón, así que el copy tiene que servirle a un
  operador, no a un desarrollador.

  Es distinto del 404: ahí el código no existe. Acá el código puede ser
  perfectamente válido y el problema está del lado del sistema.
*/
export default function ErrorFicha({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16 text-center">
      <h1 className="text-2xl font-bold text-gris-900">No se pudo cargar la ficha</h1>

      <p className="mt-3 text-base text-gris-600">
        El código está bien, pero el sistema no respondió. Casi siempre es la
        señal: espera unos segundos y vuelve a intentar.
      </p>

      <button
        type="button"
        onClick={reset}
        className="mt-7 self-center rounded-md bg-primario px-5 py-3 text-base font-semibold text-blanco transition-opacity hover:opacity-90"
      >
        Volver a intentar
      </button>

      <p className="mt-6 text-sm text-gris-500">
        Si sigue sin cargar después de varios intentos, avisa al encargado de
        mantención: el problema no está en la etiqueta.
      </p>
    </main>
  );
}
