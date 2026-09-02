# Máquina QR

Trazabilidad de mantención de maquinaria agrícola con lectura instantánea en terreno.

Cada máquina lleva pegado un código QR físico. Se escanea con la cámara del teléfono y muestra la ficha completa del activo sin login: identificación, historial de mantenciones, qué se le hizo, con qué repuestos, quién lo hizo y cuándo vence la próxima. Un panel privado permite cargar activos, registrar mantenciones, adjuntar facturas y gestionar el maestro de repuestos y proveedores.

No es un ERP.

## Stack

| Pieza | Versión | Nota |
|---|---|---|
| Next.js | 16.3.4 | App Router, TypeScript estricto, Turbopack |
| React | 19.2.8 | |
| Tailwind CSS | v4 | Sin `tailwind.config.js`. El tema vive en `src/app/globals.css` |
| Supabase | Postgres 17.6 | Única fuente de datos y de autenticación |
| `@supabase/ssr` | 0.12.5 | No usar `@supabase/auth-helpers-nextjs`, está deprecado |
| `qrcode` | 1.5.4 | Generación server-side |

Requiere Node.js 20.9 o superior.

## Arquitectura

Supabase es la única fuente de datos y de autenticación: Postgres, Auth, Storage y Row Level Security. No hay backend propio, no hay ORM, no hay capa de API intermedia. La lógica de negocio que debe ser inviolable vive en la base: constraints, triggers, vistas y funciones. La aplicación no es la guardiana de la integridad, la base lo es.

Vercel hospeda el frontend. Despliegue continuo desde GitHub: cada push a `main` va a producción, cada rama levanta un preview.

Hay dos superficies con reglas distintas:

- **Pública** (`/a/[token]`): se abre al escanear el QR, sin login. El QR contiene un token UUID v4 opaco, no el id de base de datos ni la patente. Se sirve exclusivamente a través de `get_ficha_publica(uuid)`, una función `SECURITY DEFINER` con `search_path` fijado. El rol `anon` no lee ninguna tabla base.
- **Privada** (`/admin/*`): requiere Supabase Auth. Roles `admin`, `tecnico` y `lector`.

## Setup local

```bash
npm install
cp .env.example .env.local     # completar con Project Settings -> API
npm run dev
```

Usar las claves **legacy en formato JWT** (`anon`, `service_role`), no las nuevas `sb_publishable_` / `sb_secret_`.

`SUPABASE_SERVICE_ROLE_KEY` se necesita recién en la Etapa 7. Hasta entonces ningún camino de ejecución la lee.

## Verificación

```bash
npm run build
npx eslint .
```

`next lint` fue eliminado en Next 16: se usa `eslint` directo.

## Base de datos

El proyecto Supabase de producción es `pnxnvorvuvkodutwordo` (región `sa-east-1`). Ya existe y no se debe crear otro.

La red corporativa bloquea la salida a los puertos 5432 y 6543, así que `supabase db push` falla con `Connection timed out`. El único transporte disponible hacia esa base es HTTPS por la Management API.

Cómo correr migraciones y tests: pendiente de documentar al cerrar la recuperación del schema.

## Identidad visual

Tipografía Barlow para todo el texto, autohospedada vía `next/font` para no depender de un request a Google en terreno. Primario `#002eff`, acento `#ff3d00`, secundario `#41e8b4`, más neutros grises y blanco. Ningún otro color de marca.

La escala de color por defecto de Tailwind está deshabilitada con `--color-*: initial` en `src/app/globals.css`. Clases como `bg-blue-500` no existen en este proyecto: el build no las genera. Es intencional, para que la identidad no dependa de la disciplina de quien escribe el componente.

El estado nunca se comunica solo por color. Cada estado del semáforo lleva etiqueta de texto y un glifo distinto.

## Estado por etapas

| Etapa | Alcance | Estado |
|---|---|---|
| 1 | Scaffold Next.js, Tailwind v4, Barlow, paleta Entel | Listo |
| 2 | Migraciones, RLS, buckets de Storage, seed | Pendiente |
| 3 | Vista `v_estado_mantencion`, `get_ficha_publica`, tests | Pendiente |
| 4 | Ficha pública `/a/[token]` | Pendiente |
| 5 | Auth y layout del panel privado | Pendiente |
| 6 | CRUD de activos e impresión de etiquetas QR | Pendiente |
| 7 | CRUD de mantenciones | Pendiente |
| 8 | Maestros de repuestos y proveedores | Pendiente |
| 9 | Dashboard y reportes | Pendiente |
| 10 | Configuración y cierre | Pendiente |

Nota de contexto: la base de datos de producción ya tiene su schema aplicado, pero los archivos de migración de una iteración anterior de este proyecto se perdieron antes de llegar al repositorio. Las etapas 2 y 3 se reconstruyen recuperando el DDL real desde la base viva, que es la fuente de verdad, y no reescribiéndolo de memoria.

## Pendientes de documentar

Estas secciones son parte del cierre de la Etapa 10 y se completan cuando la funcionalidad exista:

- Cómo desplegar en Vercel
- Cómo cambiar la bandera `mostrar_costos_publico`
- Cómo imprimir etiquetas QR
