"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/*
  Menu del panel.

  Client Component por una sola razon: usePathname, para marcar la seccion
  actual. Antes ninguna opcion se veia activa, asi que en una pantalla chica no
  habia forma de saber donde estabas parado.

  En movil la fila hace scroll horizontal en vez de romperse en tres lineas.
  Envolver siete secciones en un telefono empujaba el contenido media pantalla
  hacia abajo; deslizar es el gesto que la gente ya conoce de cualquier app.
  Las secciones sin construir van al final, para que el scroll no empiece
  mostrando lo que no se puede usar.
*/
export type ItemNav = {
  nombre: string;
  ruta?: string;
  etapa: number;
};

export function NavPanel({ items }: { items: ItemNav[] }) {
  const ruta = usePathname();

  const activa = (destino: string) =>
    destino === "/admin" ? ruta === "/admin" : ruta.startsWith(destino);

  return (
    <nav aria-label="Secciones del panel" className="border-t border-gris-100">
      <ul
        className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((s) => {
          if (!s.ruta) {
            return (
              <li key={s.nombre} className="shrink-0">
                <span className="inline-flex items-baseline gap-1.5 px-3 py-3 text-sm font-medium whitespace-nowrap text-gris-400">
                  {s.nombre}
                  <span className="text-xs">(en construcción)</span>
                </span>
              </li>
            );
          }

          const esta = activa(s.ruta);
          return (
            <li key={s.nombre} className="shrink-0">
              <Link
                href={s.ruta as "/admin"}
                aria-current={esta ? "page" : undefined}
                className={`inline-flex items-center border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors ${
                  esta
                    ? "border-primario font-bold text-primario"
                    : "border-transparent font-semibold text-gris-700 hover:border-gris-300 hover:text-gris-900"
                }`}
              >
                {s.nombre}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
