/*
  Logo de Agricola Santa Ines, redibujado como vector.

  El original entregado es un raster de unos 150 px de lado, con bordes
  pixelados y fondo blanco quemado. Servia para un correo y no para una
  interfaz: en pantalla se ve borroso y en una etiqueta impresa a 300 dpi peor
  todavia. Esto es la misma marca con curvas, asi que escala sin perder nitidez
  desde 16 px hasta una etiqueta impresa.

  Va en linea y no por next/image por tres razones: no agrega un request, no
  necesita configuracion del optimizador para SVG, y el archivo de /public
  queda disponible aparte para quien necesite el logo suelto.

  Los verdes de la marca viven SOLO en este archivo. La paleta de la interfaz
  esta en src/app/globals.css, y esa separacion es deliberada: la marca del
  cliente y los colores del producto se deciden por separado.
*/
export function LogoCliente({
  className = "size-11",
  conTexto = false,
}: {
  className?: string;
  /** Incluye el wordmark. Se omite cuando el nombre ya esta al lado. */
  conTexto?: boolean;
}) {
  return (
    <svg
      viewBox={conTexto ? "0 0 200 200" : "0 0 200 140"}
      className={className}
      role="img"
      aria-label="Agrícola Santa Inés"
    >
      <title>Agrícola Santa Inés</title>

      <defs>
        <linearGradient id="asi-hoja-clara" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A5CE4E" />
          <stop offset="1" stopColor="#7FB539" />
        </linearGradient>
        <linearGradient id="asi-hoja-oscura" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3E8E41" />
          <stop offset="1" stopColor="#256A2E" />
        </linearGradient>
      </defs>

      {/* Hoja izquierda, clara: curva ancha que nace abajo al centro. */}
      <path
        d="M100 128 C 62 122, 34 96, 30 58 C 62 44, 92 58, 104 88 C 108 100, 106 116, 100 128 Z"
        fill="url(#asi-hoja-clara)"
      />

      {/* Hoja derecha, oscura: mas estilizada y algo mas alta. */}
      <path
        d="M100 128 C 104 92, 128 62, 168 52 C 172 92, 148 120, 108 130 C 105 130, 102 129, 100 128 Z"
        fill="url(#asi-hoja-oscura)"
      />

      {/* Nervadura: recorta la hoja oscura, como en el original. */}
      <path
        d="M101 129 C 112 106, 134 82, 162 66 C 138 88, 116 110, 105 130 Z"
        fill="#FFFFFF"
      />

      {conTexto ? (
        <>
          <text
            x="100"
            y="164"
            textAnchor="middle"
            fontFamily="Barlow, system-ui, sans-serif"
            fontSize="27"
            fontWeight="600"
            fill="#4C9A3D"
          >
            Agrícola
          </text>
          <text
            x="100"
            y="190"
            textAnchor="middle"
            fontFamily="Barlow, system-ui, sans-serif"
            fontSize="27"
            fontWeight="600"
            fill="#4C9A3D"
          >
            Santa Inés
          </text>
        </>
      ) : null}
    </svg>
  );
}
