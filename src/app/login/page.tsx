import type { Metadata } from "next";
import { credencialesDemo } from "@/lib/env";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = {
  title: "Entrar · Máquina QR",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  // searchParams es una Promise desde Next 15. No hay acceso sincronico.
  const { volver } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <div className="border-b-4 border-primario pb-5">
        <p className="text-xs font-bold tracking-widest text-primario uppercase">
          Mantención de maquinaria
        </p>
        <h1 className="mt-1 text-3xl font-bold text-gris-900">Máquina QR</h1>
      </div>

      <p className="mt-6 mb-7 text-base text-gris-600">
        Panel privado. La ficha que se abre al escanear un código QR no necesita
        cuenta.
      </p>

      {/*
        Las credenciales de demostracion se leen en el servidor. Si las
        variables no estan cargadas, el recuadro simplemente no aparece: la
        demo se apaga sin desplegar nada.
      */}
      <FormularioLogin volver={volver ?? "/admin"} demo={credencialesDemo()} />
    </main>
  );
}
