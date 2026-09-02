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

`anon` puede ejecutar exactamente **dos** funciones y no tiene un solo grant de tabla en `public`:

| Función | Para qué |
|---|---|
| `get_ficha_publica(uuid, text)` | La ficha que se abre al escanear el QR |
| `credenciales_demo()` | El correo y la clave de la cuenta de demostración que `/login` publica |

Verificable con:

```sql
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
```

Si esa consulta devuelve algo distinto de esas dos, algo se expuso sin querer. Postgres otorga `EXECUTE` al pseudo-rol `PUBLIC` en cada función nueva, igual que Supabase expone cada tabla nueva a `anon`, así que una función agregada sin cuidado vuelve a abrir la puerta. Los privilegios por defecto del schema ya están ajustados para que no ocurra, y por eso cada grant nuevo tiene que ser explícito.

`credenciales_demo()` devuelve una contraseña en texto claro a cualquiera que la invoque, y eso es intencional: su único propósito es que la página la imprima en pantalla. La cuenta que devuelve **tiene que ser de solo lectura**.

## Identidad visual

Tipografía Barlow para todo el texto, autohospedada vía `next/font` para no depender de un request a Google en terreno. Primario `#002eff`, acento `#ff3d00`, secundario `#41e8b4`, más neutros grises y blanco. Ningún otro color de marca.

La escala de color por defecto de Tailwind está deshabilitada con `--color-*: initial` en `src/app/globals.css`. Clases como `bg-blue-500` no existen en este proyecto: el build no las genera. Es intencional, para que la identidad no dependa de la disciplina de quien escribe el componente.

El estado nunca se comunica solo por color. Cada estado del semáforo lleva etiqueta de texto y un glifo distinto.

## Estado por etapas

| Etapa | Alcance | Estado |
|---|---|---|
| 1 | Scaffold Next.js, Tailwind v4, Barlow, paleta Entel | Listo |
| 2 | Migraciones, RLS, buckets de Storage, seed | Listo |
| 3 | Vista `v_estado_mantencion`, `get_ficha_publica`, tests | Objetos recuperados y verificados. Tests pgTAP pendientes |
| 4 | Ficha pública `/a/[token]` | Listo |
| 5 | Auth y layout del panel privado | Listo |
| 6 | CRUD de activos e impresión de etiquetas QR | Listado, alta e impresión listos. Ficha de detalle pendiente |
| 7 | CRUD de mantenciones | Pendiente |
| 8 | Maestros de repuestos y proveedores | Pendiente |
| 9 | Dashboard y reportes | Pendiente |
| 10 | Configuración y cierre | Pendiente |

Nota de contexto: la base de datos de producción ya tiene su schema aplicado, pero los archivos de migración de una iteración anterior de este proyecto se perdieron antes de llegar al repositorio. Las etapas 2 y 3 se reconstruyen recuperando el DDL real desde la base viva, que es la fuente de verdad, y no reescribiéndolo de memoria.

## Despliegue en Vercel

Producción: **https://maquina-qr.vercel.app**

El repositorio está conectado y queda con despliegue continuo: cada push a `main` va a producción, cada rama levanta un preview. Next.js se detecta solo, no hace falta configurar comandos de build.

Dos cosas que confunden la primera vez:

- **Conectar el repositorio no dispara un despliegue.** Si el proyecto se crea antes de conectar el Git, Vercel queda esperando el próximo push y en la pestaña Deployments no aparece nada. No es un error de configuración: no hay nada que publicar hasta que llegue un commit.
- **Las URL con hash del deployment responden 302, no 200.** Tienen Vercel Authentication activada y redirigen al login de Vercel. Eso es lo correcto y no hay que desactivarlo: la que se comparte es la de producción, que sí es pública.

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

Hoy el dominio de producción es `https://maquina-qr.vercel.app`. Si en algún momento se conecta un dominio propio, hay que decidirlo **antes** de imprimir, porque Vercel mantiene el `.vercel.app` funcionando pero las etiquetas quedarían apuntando a una URL que no es la institucional.

## Panel privado

`/login` y `/admin` están en producción. Tres capas, con responsabilidades distintas y sin superposición:

1. **`src/proxy.ts`** refresca la cookie de sesión y hace un chequeo optimista que redirige a `/login`. Es comodidad de navegación, **no** autorización.
2. **`src/lib/auth.ts`** valida la sesión con `getUser()`, que contrasta el token contra el servidor de Auth, y expone `requiereRol()` para usar dentro de cada Server Action.
3. **Las políticas RLS** son la última palabra. Si las dos capas anteriores fallaran, la base sigue rechazando.

El matcher del proxy excluye `/a/`, la ficha pública, para no agregarle una validación de token en cada escaneo. Eso es seguro **solo** porque esa ruta no invoca ninguna Server Function: si algún día se le agrega una, hay que sacar la exclusión, porque el matcher también la excluiría a ella.

### Cuentas de demostración

Las passwords no están en el repositorio ni en el historial. Viven en un archivo fuera del árbol, por defecto `~/maquina-qr-credenciales-demo.txt`, una línea por cuenta con "correo password", el password en el primer token.

**El login está publicado en internet.** Las de `admin` y `tecnico` son largas y aleatorias, no `demo1234`, porque esas dos pueden escribir. Si el panel va a tener usuarios reales, lo primero es crear cuentas nominativas y borrar las de demostración.

### Acceso de demostración

La portada tiene un botón **Ingresar como DEMO** que entra al panel en un clic, y `/login` muestra además un recuadro con el correo y la contraseña en texto, para poder copiarlos o compartirlos por mensaje.

**La cuenta publicada es `demo@demo.local` y tiene rol `admin`.** Es una decisión explícita del dueño del proyecto, tomada para que la demostración permita el flujo completo: cargar un activo, imprimir su etiqueta QR y escanearla. Crear activos exige `es_admin()` por la política `activos_admin`, y no existe un rol intermedio que lo permita.

La consecuencia está asumida y conviene tenerla escrita: **cualquiera con el link puede crear, editar y borrar** activos, mantenciones y maestros. Se acepta porque los datos son ficticios y porque `supabase/seed.sql` restaura la demo completa en un comando, ya probado.

Si el proyecto deja de ser una demostración, lo primero es bajar esa cuenta:

```sql
update public.profiles set rol = 'lector' where email = 'demo@demo.local';
```

Las cuentas `admin@demo.local`, `tecnico@demo.local` y `lector@demo.local` siguen existiendo con sus roles originales y sirven para probar el comportamiento por rol con `scripts/verifica-auth.mjs`.

Las credenciales viven en la tabla `acceso_demo`, de una sola fila, y se leen con la función `credenciales_demo()`. No están en el repositorio ni en el historial de git: la migración crea la fila apagada y sin clave, y la clave se carga por SQL.

```sql
-- Cargar o rotar la clave de la demo
update public.acceso_demo set password = '...', habilitado = true where id;

-- Apagar la demo. El botón y el recuadro dejan de renderizarse.
update public.acceso_demo set habilitado = false where id;
```

Ninguna de las dos cosas requiere desplegar.

`DEMO_EMAIL` y `DEMO_PASSWORD` siguen funcionando como sobrescritura, y `DEMO_DESACTIVADO=1` apaga la demo desde el entorno. Van sin el prefijo `NEXT_PUBLIC_`: se leen en el servidor y se imprimen en el HTML deliberadamente, pero no viajan en el bundle del cliente. Verificable buscando la contraseña en `.next/static/chunks/`, donde no aparece.

Por qué no se resolvió con una constante en el código, que sería más simple: la regla de cero credenciales en el repositorio menciona explícitamente las contraseñas de demostración. Y por qué no solo con variables de entorno, que sería más limpio: en Vercel hay que cargarlas a mano y redesplegar, y mientras eso no pase la funcionalidad no existe en producción. La tabla la deja operativa desde el primer deploy.

El botón de la portada se renderiza siempre, sin consultar antes si la demo está habilitada, para no convertir una página estática en una consulta a la base por cada visita. Si la demo estuviera apagada, el clic responde que no está disponible.

### Verificar las políticas por rol

```bash
node scripts/verifica-auth.mjs
```

Inicia sesión de verdad con cada cuenta y comprueba lo que cada rol puede y no puede hacer. Las pruebas que importan son las negativas: que un botón esté oculto no prueba nada.

Una trampa que conviene conocer antes de escribir más pruebas de RLS: **un UPDATE o un DELETE cuyo filtro no calza con ninguna fila devuelve 204 aunque la política lo bloquee**, porque RLS filtra las filas afectadas y no queda ninguna. Probar con un id inexistente no mide nada. Hay que usar filas reales y la cabecera `Prefer: return=representation`, que devuelve las filas efectivamente modificadas: arreglo vacío significa bloqueado.

El borrado no se prueba por comportamiento, porque la única prueba concluyente sería destructiva. Se verifica estructuralmente: si una tabla no tiene política de `DELETE` ni de `ALL`, nadie borra. `movimientos_stock` no tiene ninguna de las dos, y de ahí sale que sea append only incluso para el administrador.

## Verificado en producción

Con `mostrar_costos_publico = false`, medido sobre el HTML que devuelve el servidor y no sobre la interfaz:

| Chequeo | Resultado |
|---|---|
| Las 6 fichas del seed | HTTP 200, entre 0,46 s y 1,2 s |
| `costo_total`, `monto_*`, `numero_factura`, `proveedor`, `subtotal` en el HTML | 0 coincidencias en las 5 fichas con historial |
| Plan vencido por horómetro (BR-001) | "Excedida en 210 h de uso", sin fecha estimada |
| Activo sin historial (EN-001) | Muestra el estado vacío |
| Token inexistente y token con formato inválido | HTTP 404, texto idéntico |
| Cabecera de la ficha | `noindex, nofollow, nocache` y `Cache-Control: private, no-store` |

## Pendientes de documentar

Estas secciones son parte del cierre de la Etapa 10 y se completan cuando la funcionalidad exista:

- Cómo cambiar la bandera `mostrar_costos_publico`
- Cómo imprimir etiquetas QR
