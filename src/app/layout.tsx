import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";

/*
  Barlow no es fuente variable en Google Fonts, por eso hay que declarar los
  pesos uno por uno. Se cargan cuatro y no los nueve disponibles: cada peso es
  un archivo mas que baja el telefono, y la ficha publica se abre en terreno con
  senal mala. next/font autohospeda los archivos, asi que no hay request a
  fonts.googleapis.com en tiempo de ejecucion.
*/
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "Máquina QR",
  description:
    "Trazabilidad de mantención de maquinaria agrícola con lectura por código QR en terreno.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className={barlow.variable}>
      <body className="bg-blanco font-sans text-gris-900 antialiased">
        {children}
      </body>
    </html>
  );
}
