/*
  Token no reconocido.

  El mensaje es a proposito el mismo para un token mal escrito, uno inexistente
  y un activo dado de baja. Si dijera "este activo fue dado de baja" en un caso
  y "no existe" en otro, cualquiera podria distinguir tokens validos de
  invalidos sin llegar a ver una ficha.
*/
export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16 text-center">
      <h1 className="text-2xl font-bold text-gris-900">Código no reconocido</h1>

      <p className="mt-3 text-base text-gris-600">
        Este código QR no corresponde a ningún activo registrado. Puede estar dañado, o la etiqueta
        puede pertenecer a otra instalación.
      </p>

      <p className="mt-6 text-sm text-gris-500">
        Si la etiqueta está pegada a una máquina en operación, avisa al encargado de mantención para
        que la vuelva a generar.
      </p>
    </main>
  );
}
