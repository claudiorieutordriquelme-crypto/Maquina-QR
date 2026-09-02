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

### Desarrollo local detrás del proxy corporativo

En la red de Entel el tráfico HTTPS sale re-firmado por Zscaler, y Node solo confía en su bundle interno de CAs: no lee el almacén de certificados de Windows, porque `--use-system-ca` recién existe desde Node 22. Resultado: cualquier llamada del servidor a Supabase falla con `TypeError: fetch failed` y la ficha responde 500, aunque `curl` al mismo host funcione.

Se resuelve exportando el almacén de Windows a un bundle PEM y apuntando Node ahí:

```powershell
$out = "$env:USERPROFILE\ca-windows.pem"
$lineas = New-Object System.Collections.Generic.List[string]
foreach ($almacen in @("Cert:\LocalMachine\Root","Cert:\LocalMachine\CA","Cert:\CurrentUser\Root","Cert:\CurrentUser\CA")) {
  foreach ($c in (Get-ChildItem $almacen)) {
    $lineas.Add("-----BEGIN CERTIFICATE-----")
    $lineas.Add([Convert]::ToBase64String($c.RawData,'InsertLineBreaks'))
    $lineas.Add("-----END CERTIFICATE-----")
  }
}
$lineas | Out-File -Encoding ascii $out
```

Y después, en cada sesión de desarrollo:

```bash
NODE_EXTRA_CA_CERTS="$USERPROFILE/ca-windows.pem" npm run dev
```

Lo que **nunca** se debe hacer es `NODE_TLS_REJECT_UNAUTHORIZED=0`. Eso apaga la validación de certificados para todo el proceso, incluidas las llamadas que llevan claves de Supabase.

Este problema no existe en Vercel: ahí no hay proxy de inspección.

## Verificación

```bash
npm run build
npx eslint .
```

`next lint` fue eliminado en Next 16: se usa `eslint` directo.

## Base de datos

El proyecto Supabase de producción es `pnxnvorvuvkodutwordo` (región `sa-east-1`). Ya existe y no se debe crear otro.

La red corporativa bloquea la salida a los puertos 5432 y 6543, así que `supabase db push` falla con `Connection timed out`. El único transporte disponible hacia esa base es HTTPS por la Management API.

### Correr SQL contra la base

```bash
# El token va en un archivo fuera del repo, nunca versionado
echo "sbp_..." > ~/.supabase_token

node scripts/sql-remoto.mjs consulta.sql          # tabla legible
node scripts/sql-remoto.mjs consulta.sql --json   # JSON crudo
node scripts/sql-remoto.mjs consulta.sql --raw    # primera columna, para volcar DDL
```

El script intenta `fetch` y cae a `curl` solo ante error de certificado, porque el proxy de inspección de la red re-firma el tráfico a `api.supabase.com` y Node 20 no lee el almacén de certificados de Windows. No desactiva la validación TLS en ningún caso.

Para probar una migración sin aplicarla se la envuelve en `begin; ... rollback;`. Para verificar que corre desde base vacía se crea un schema desechable y se reemplaza el prefijo `public.`. Así se validaron las nueve migraciones actuales.

### Recuperación del schema

Los archivos de migración originales se perdieron antes de llegar al repositorio. El registro `supabase_migrations.schema_migrations` conservó el nombre y el orden de las ocho migraciones, pero con el arreglo `statements` vacío, así que el texto SQL hubo que reconstruirlo desde el catálogo de la base viva. Las definiciones de funciones, vistas, triggers, constraints e índices son textuales; las sentencias `create table` se rearmaron desde `pg_attribute`.

Desde la migración `20260902121000` en adelante, el texto completo de cada migración queda registrado en `statements` al aplicarla. Esa pérdida no puede repetirse.

### Superficie del rol anon

`anon` puede ejecutar exactamente una función, `get_ficha_publica(uuid, text)`, y no tiene un solo grant de tabla en `public`. Verificable con:

```sql
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
```

Si esa consulta devuelve más de una fila, algo se expuso sin querer. Postgres otorga `EXECUTE` al pseudo-rol `PUBLIC` en cada función nueva, igual que Supabase expone cada tabla nueva a `anon`, así que una función agregada sin cuidado vuelve a abrir la puerta. Los privilegios por defecto del schema ya están ajustados para que no ocurra.

## Identidad visual

Tipografía Barlow para todo el texto, autohospedada vía `next/font` para no depender de un request a Google en terreno. Primario `#002eff`, acento `#ff3d00`, secundario `#41e8b4`, más neutros grises y blanco. Ningún otro color de marca.

La escala de color por defecto de Tailwind está deshabilitada con `--color-*: initial` en `src/app/globals.css`. Clases como `bg-blue-500` no existen en este proyecto: el build no las genera. Es intencional, para que la identidad no dependa de la disciplina de quien escribe el componente.

El estado nunca se comunica solo por color. Cada estado del semáforo lleva etiqueta de texto y un glifo distinto.

## Estado por etapas

| Etapa | Alcance | Estado |
|---|---|---|
| 1 | Scaffold Next.js, Tailwind v4, Barlow, paleta Entel | Listo |
| 2 | Migraciones, RLS, buckets de Storage, seed | Migraciones listas y verificadas. Seed pendiente |
| 3 | Vista `v_estado_mantencion`, `get_ficha_publica`, tests | Objetos recuperados y verificados. Tests pgTAP pendientes |
| 4 | Ficha pública `/a/[token]` | Listo |
| 5 | Auth y layout del panel privado | Pendiente |
| 6 | CRUD de activos e impresión de etiquetas QR | Pendiente |
| 7 | CRUD de mantenciones | Pendiente |
| 8 | Maestros de repuestos y proveedores | Pendiente |
| 9 | Dashboard y reportes | Pendiente |
| 10 | Configuración y cierre | Pendiente |

Nota de contexto: la base de datos de producción ya tiene su schema aplicado, pero los archivos de migración de una iteración anterior de este proyecto se perdieron antes de llegar al repositorio. Las etapas 2 y 3 se reconstruyen recuperando el DDL real desde la base viva, que es la fuente de verdad, y no reescribiéndolo de memoria.

## Despliegue en Vercel

El repositorio se importa en Vercel y queda con despliegue continuo: cada push a `main` va a producción, cada rama levanta un preview. Next.js se detecta solo, no hace falta configurar comandos de build.

Variables de entorno que hay que cargar en Vercel, en Production y en Preview:

| Variable | Cuándo se necesita | Valor |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Ahora | `https://pnxnvorvuvkodutwordo.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ahora | La clave `anon` en formato JWT, desde Project Settings, API |
| `NEXT_PUBLIC_APP_URL` | Etapa 6 | El dominio definitivo de producción |
| `SUPABASE_SERVICE_ROLE_KEY` | Etapa 7 | Solo en Production, nunca con prefijo `NEXT_PUBLIC_` |

Con las dos primeras la ficha pública ya funciona. Las otras dos se cargan cuando su etapa las necesite: una clave que no está cargada es una clave que no se puede filtrar.

`engines.node` está fijado en `22.x` porque `@supabase/supabase-js` ya marca Node 20 como deprecado.

### El dominio antes de imprimir

`NEXT_PUBLIC_APP_URL` es la base de todos los QR impresos. Si el dominio cambia después de imprimir una flota, las etiquetas quedan apuntando al dominio viejo y hay que reimprimirlas una por una. El dominio definitivo se decide antes de habilitar la impresión masiva de la Etapa 6, no después.

## Pendientes de documentar

Estas secciones son parte del cierre de la Etapa 10 y se completan cuando la funcionalidad exista:

- Cómo cambiar la bandera `mostrar_costos_publico`
- Cómo imprimir etiquetas QR
