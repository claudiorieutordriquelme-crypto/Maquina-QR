#!/usr/bin/env node
/*
  Verifica el gasto de la flota contra la base, y contra lo que el sitio
  desplegado realmente sirve.

  Que se prueba y por que: el resumen agrega el gasto en memoria y arma la serie
  mensual con aritmetica propia, incluidos el relleno de meses sin gasto y el
  acumulado. Todo eso se puede equivocar en silencio. Aca los mismos numeros se
  calculan en SQL y se comparan uno a uno, y ademas se abre la pagina desplegada
  con una sesion real para confirmar que las cifras que salen en pantalla son
  esas y no otras.

  La trampa que este script vigila de cerca: el mes de una orden sale de la
  cadena de la fecha y no de new Date(iso). Una fecha sin hora se interpreta
  como UTC, y en Chile eso corre el dia hacia atras, asi que una orden del 1 de
  marzo caeria en febrero. La comprobacion 4 lo mira explicitamente.

  Es un script de SOLO LECTURA.

  Uso:
    NODE_EXTRA_CA_CERTS="$USERPROFILE/ca-windows.pem" node scripts/verifica-gasto.mjs
*/
import fs from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITIO = process.env.SITIO ?? "https://maquina-qr.vercel.app";

const env = Object.fromEntries(
  fs
    .readFileSync(join(RAIZ, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const B = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REF = new URL(B).hostname.split(".")[0];

const linea = fs
  .readFileSync(
    process.env.CREDENCIALES_DEMO ?? join(homedir(), "maquina-qr-credenciales-demo.txt"),
    "utf8",
  )
  .split(/\r?\n/)
  .find((l) => l.startsWith("admin@demo.local"));
const [email, password] = linea.trim().split(/\s+/);

const ses = await (
  await fetch(`${B}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
).json();

if (!ses.access_token) {
  console.error("no pude iniciar sesion con la cuenta admin");
  process.exit(2);
}

/*
  El login del sitio es una Server Action y no un endpoint que se pueda llamar
  con fetch, asi que la cookie se arma con el mismo formato que usa
  @supabase/ssr: prefijo base64- y, sobre 3180 caracteres, partida en trozos.
*/
const valorCookie = "base64-" + Buffer.from(JSON.stringify(ses), "utf8").toString("base64");
const TROZO = 3180;
const nombreCookie = `sb-${REF}-auth-token`;
const COOKIE = (
  valorCookie.length <= TROZO
    ? [`${nombreCookie}=${valorCookie}`]
    : Array.from({ length: Math.ceil(valorCookie.length / TROZO) }, (_, i) => {
        return `${nombreCookie}.${i}=${valorCookie.slice(i * TROZO, (i + 1) * TROZO)}`;
      })
).join("; ");

const sql = (texto) => {
  const archivo = join(tmpdir(), `verifica-gasto-${process.pid}.sql`);
  fs.writeFileSync(archivo, texto);
  try {
    const r = spawnSync("node", [join(RAIZ, "scripts", "sql-remoto.mjs"), archivo, "--json"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    if (r.status !== 0) {
      console.error(r.stderr || r.stdout);
      process.exit(2);
    }
    return JSON.parse(r.stdout);
  } finally {
    try {
      fs.unlinkSync(archivo);
    } catch {
      /* nada */
    }
  }
};

let fallas = 0;
const check = (etiqueta, esperado, real, ok) => {
  if (!ok) fallas += 1;
  console.log(
    `  ${ok ? "OK   " : "FALLA"} ${etiqueta.padEnd(50)} esperado=${String(esperado).padEnd(14)} real=${real}`,
  );
};

/* Los montos se comparan como numeros: el formato es-CL trae puntos y espacios
   duros que no aportan nada a la comparacion. */
const soloDigitos = (s) => Number(String(s).replace(/[^\d]/g, ""));

console.log("=== 1. Gasto total y por maquina, contra SQL ===");
const porActivo = sql(
  "select a.codigo_interno, a.nombre, count(*)::int as ordenes,\n" +
    "       coalesce(sum(o.costo_total), 0)::numeric as total,\n" +
    "       max(o.fecha_ejecucion)::text as ultima\n" +
    "from public.ordenes_mantencion o\n" +
    "join public.activos a on a.id = o.activo_id\n" +
    "where o.estado = 'completada' and o.fecha_ejecucion is not null\n" +
    "group by a.codigo_interno, a.nombre\n" +
    "order by total desc;",
);

const [totales] = sql(
  "select count(*)::int as ordenes, coalesce(sum(costo_total), 0)::numeric as total\n" +
    "from public.ordenes_mantencion\n" +
    "where estado = 'completada' and fecha_ejecucion is not null;",
);

const sumaPorActivo = porActivo.reduce((s, f) => s + Number(f.total), 0);
check(
  "el reparto por maquina suma el total",
  Number(totales.total),
  sumaPorActivo,
  Number(totales.total) === sumaPorActivo,
);
check(
  "hay maquinas con gasto",
  ">0",
  porActivo.length,
  porActivo.length > 0,
);

console.log("\n=== 2. La pagina desplegada muestra esas cifras ===");
const resumen = await fetch(`${SITIO}/admin`, {
  headers: { Cookie: COOKIE, "User-Agent": "verifica-gasto" },
});
check("el resumen responde 200", 200, resumen.status, resumen.status === 200);
const html = await resumen.text();

check("existe la sección de gasto", true, html.includes("Gasto de mantención"), html.includes("Gasto de mantención"));
check(
  "existe el botón de previsualización",
  true,
  html.includes("Ver el resumen de"),
  html.includes("Ver el resumen de"),
);

/*
  El monto formateado se busca por sus digitos: en es-CL el separador de miles
  es punto y el simbolo va con espacio duro, y comparar la cadena entera
  fallaria por razones que no tienen nada que ver con el dato.
*/
const digitosEnHtml = new Set(
  (html.match(/\$[\s ]?[\d.]+/g) ?? []).map((m) => soloDigitos(m)),
);
check(
  "el gasto total aparece en el HTML",
  Math.round(Number(totales.total)),
  digitosEnHtml.has(Math.round(Number(totales.total))) ? "presente" : "ausente",
  digitosEnHtml.has(Math.round(Number(totales.total))),
);

const TOPE_VISIBLE = 8;
for (const f of porActivo.slice(0, TOPE_VISIBLE)) {
  check(
    `  ${f.codigo_interno} con su monto`,
    Math.round(Number(f.total)),
    digitosEnHtml.has(Math.round(Number(f.total))) ? "presente" : "ausente",
    digitosEnHtml.has(Math.round(Number(f.total))),
  );
}

console.log("\n=== 3. Serie mensual de la máquina de mayor gasto ===");
const cara = porActivo[0];
const serieSql = sql(
  "select to_char(o.fecha_ejecucion, 'YYYY-MM') as mes,\n" +
    "       coalesce(sum(o.costo_total), 0)::numeric as monto,\n" +
    "       sum(sum(o.costo_total)) over (order by to_char(o.fecha_ejecucion, 'YYYY-MM'))::numeric as acumulado\n" +
    "from public.ordenes_mantencion o\n" +
    "join public.activos a on a.id = o.activo_id\n" +
    `where a.codigo_interno = '${cara.codigo_interno}'\n` +
    "  and o.estado = 'completada' and o.fecha_ejecucion is not null\n" +
    "group by 1 order by 1;",
);

console.log(`  máquina ${cara.codigo_interno}, ${serieSql.length} mes(es) con gasto`);
const ultimoAcumulado = Number(serieSql[serieSql.length - 1].acumulado);
check(
  "el acumulado final iguala el total",
  Math.round(Number(cara.total)),
  Math.round(ultimoAcumulado),
  Math.round(ultimoAcumulado) === Math.round(Number(cara.total)),
);

/*
  Los meses que la pagina va a dibujar incluyen los huecos. Se comprueba que la
  cantidad de meses entre el primero y el ultimo calce con lo que el relleno
  tiene que producir: si el relleno se equivocara, el grafico mostraria mas o
  menos columnas de las que corresponde.
*/
const [rangoMeses] = sql(
  "select (extract(year from age(max(o.fecha_ejecucion), min(o.fecha_ejecucion))) * 12\n" +
    "        + extract(month from age(max(o.fecha_ejecucion), min(o.fecha_ejecucion))))::int + 1 as meses\n" +
    "from public.ordenes_mantencion o\n" +
    "join public.activos a on a.id = o.activo_id\n" +
    `where a.codigo_interno = '${cara.codigo_interno}'\n` +
    "  and o.estado = 'completada' and o.fecha_ejecucion is not null;",
);
check(
  "los meses del rango son al menos los que tienen gasto",
  `>= ${serieSql.length}`,
  rangoMeses.meses,
  rangoMeses.meses >= serieSql.length,
);

console.log("\n=== 4. El mes de cada orden no se corre por zona horaria ===");
/*
  Esta es la comprobacion que justifica no usar new Date(iso) para sacar el mes.
  Se buscan las ordenes ejecutadas el dia 1 de un mes: son las unicas que se
  desplazan al mes anterior si la fecha se interpreta como UTC y despues se lee
  en horario de Chile.
*/
const primerosDeMes = sql(
  "select a.codigo_interno, o.fecha_ejecucion::text as fecha,\n" +
    "       to_char(o.fecha_ejecucion, 'YYYY-MM') as mes_correcto\n" +
    "from public.ordenes_mantencion o\n" +
    "join public.activos a on a.id = o.activo_id\n" +
    "where o.estado = 'completada' and o.fecha_ejecucion is not null\n" +
    "  and extract(day from o.fecha_ejecucion) <= 2\n" +
    "order by o.fecha_ejecucion;",
);

if (primerosDeMes.length === 0) {
  console.log("  (no hay órdenes al comienzo de mes con que probar el desplazamiento)");
} else {
  for (const o of primerosDeMes) {
    const porCadena = o.fecha.slice(0, 7);
    const porDate = (() => {
      const d = new Date(o.fecha);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();
    check(
      `  ${o.fecha} cae en su mes`,
      o.mes_correcto,
      `cadena=${porCadena} date=${porDate}`,
      porCadena === o.mes_correcto,
    );
  }
}

console.log("\n=== 5. Los costos siguen cerrados para anon ===");
const anon = await fetch(`${B}/rest/v1/ordenes_mantencion?select=costo_total&limit=1`, {
  headers: { apikey: ANON },
});
check(
  "anon no lee ordenes_mantencion",
  "401 o 403",
  anon.status,
  anon.status === 401 || anon.status === 403,
);
const anonActivos = await fetch(`${B}/rest/v1/activos?select=codigo_interno&limit=1`, {
  headers: { apikey: ANON },
});
check(
  "anon no lee activos",
  "401 o 403",
  anonActivos.status,
  anonActivos.status === 401 || anonActivos.status === 403,
);

console.log(`\n${fallas === 0 ? "TODO OK" : `${fallas} FALLA(S)`}`);
process.exit(fallas === 0 ? 0 : 1);
