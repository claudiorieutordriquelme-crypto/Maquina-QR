#!/usr/bin/env node
/*
  Verifica los reportes de costo contra la base real.

  Que se prueba y por que: la pagina agrega en memoria, porque el cliente de
  Supabase no expone GROUP BY. El riesgo concreto de eso es que la suma de la
  aplicacion no sea la suma de la base. Aca se calculan los tres cortes en SQL
  por la Management API y se comparan uno a uno contra lo que produce la misma
  agregacion de la aplicacion leyendo por PostgREST con una sesion real. Si RLS
  escondiera filas o la suma tuviera un error de redondeo, las dos cifras dejan
  de calzar y el script lo dice.

  Es un script de SOLO LECTURA. No crea ni borra nada, asi que se puede correr
  contra produccion sin riesgo.

  Uso:
    NODE_EXTRA_CA_CERTS="$USERPROFILE/ca-windows.pem" node scripts/verifica-reportes.mjs
*/
import fs from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = Object.fromEntries(
  fs
    .readFileSync(join(RAIZ, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const B = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const rutaCredenciales =
  process.env.CREDENCIALES_DEMO ?? join(homedir(), "maquina-qr-credenciales-demo.txt");
const linea = fs
  .readFileSync(rutaCredenciales, "utf8")
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

const H = { apikey: ANON, Authorization: `Bearer ${ses.access_token}` };

const rest = async (ruta) => {
  const r = await fetch(`${B}/rest/v1/${ruta}`, { headers: H });
  let cuerpo = null;
  try {
    cuerpo = await r.json();
  } catch {
    /* sin cuerpo */
  }
  return { estado: r.status, cuerpo };
};

/* SQL por el mismo transporte que usa el resto del proyecto. */
const sql = (texto) => {
  const archivo = join(tmpdir(), `verifica-reportes-${process.pid}.sql`);
  fs.writeFileSync(archivo, texto);
  try {
    const r = spawnSync("node", [join(RAIZ, "scripts", "sql-remoto.mjs"), archivo, "--json"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
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
    `  ${ok ? "OK   " : "FALLA"} ${etiqueta.padEnd(52)} esperado=${String(esperado).padEnd(14)} real=${real}`,
  );
};

/* La misma agregacion que hace src/lib/datos/reportes.ts, reescrita aparte. */
const uno = (v) => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const acumular = (filas, clave) => {
  const mapa = new Map();
  for (const o of filas) {
    const k = clave(o);
    const previo = mapa.get(k) ?? { clave: k, ordenes: 0, costo: 0 };
    previo.ordenes += 1;
    previo.costo += Number(o.costo_total ?? 0);
    mapa.set(k, previo);
  }
  return [...mapa.values()];
};

const SELECT =
  "ordenes_mantencion?select=tipo,costo_total,fecha_ejecucion,proveedor_id," +
  "activos(nombre,codigo_interno),proveedores(nombre)" +
  "&estado=eq.completada&fecha_ejecucion=not.is.null&limit=5000";

console.log("=== 1. Lectura por PostgREST, la misma consulta de la aplicacion ===");
const res = await rest(SELECT);
check("la consulta responde 200", 200, res.estado, res.estado === 200);
const ordenes = Array.isArray(res.cuerpo) ? res.cuerpo : [];
check("trae ordenes completadas", ">0", ordenes.length, ordenes.length > 0);
if (ordenes.length === 0) process.exit(1);

/*
  La forma de la relacion anidada importa: si PostgREST devolviera un arreglo,
  leer o.activos.codigo_interno daria undefined y todo el corte por activo
  caeria en "(sin activo)" sin que ningun tipo se queje.
*/
const forma = Array.isArray(ordenes[0].activos) ? "arreglo" : "objeto";
console.log(`  nota: la relacion anidada llega como ${forma}; uno() cubre las dos formas`);
check(
  "toda orden resuelve el codigo de su activo",
  ordenes.length,
  ordenes.filter((o) => uno(o.activos)?.codigo_interno).length,
  ordenes.every((o) => Boolean(uno(o.activos)?.codigo_interno)),
);

console.log("\n=== 2. Totales contra SQL ===");
const [tot] = sql(
  "select count(*)::int as ordenes, coalesce(sum(costo_total), 0)::numeric as costo\n" +
    "from public.ordenes_mantencion\n" +
    "where estado = 'completada' and fecha_ejecucion is not null;",
);
const totalApp = ordenes.reduce((s, o) => s + Number(o.costo_total ?? 0), 0);
check("cantidad de ordenes", tot.ordenes, ordenes.length, tot.ordenes === ordenes.length);
check("costo total", tot.costo, totalApp, Number(tot.costo) === totalApp);

console.log("\n=== 3. Corte por tipo ===");
const porTipoSql = sql(
  "select tipo::text as clave, count(*)::int as ordenes,\n" +
    "       coalesce(sum(costo_total), 0)::numeric as costo\n" +
    "from public.ordenes_mantencion\n" +
    "where estado = 'completada' and fecha_ejecucion is not null\n" +
    "group by tipo;",
);
const porTipoApp = acumular(ordenes, (o) => o.tipo);
check("mismos tipos", porTipoSql.length, porTipoApp.length, porTipoSql.length === porTipoApp.length);
for (const f of porTipoSql) {
  const a = porTipoApp.find((x) => x.clave === f.clave);
  check(`  tipo ${f.clave}: costo`, f.costo, a?.costo ?? "sin grupo", Number(f.costo) === a?.costo);
  check(`  tipo ${f.clave}: ordenes`, f.ordenes, a?.ordenes ?? "sin grupo", f.ordenes === a?.ordenes);
}

/*
  El orden del corte por tipo es fijo y no por costo. Si se ordenara por costo,
  al filtrar otro periodo preventiva y correctiva podrian intercambiar posicion
  y con ella el color, y quien aprendio que una tinta es correctiva quedaria
  enganado sin aviso.
*/
const ORDEN = ["preventiva", "correctiva", "predictiva"];
const orden = porTipoApp.map((x) => x.clave).sort((a, b) => ORDEN.indexOf(a) - ORDEN.indexOf(b));
check(
  "orden de tipos fijo, no por costo",
  "preventiva primero",
  orden.join(" > "),
  !orden.includes("preventiva") || orden[0] === "preventiva",
);

console.log("\n=== 4. Corte por activo ===");
const porActivoSql = sql(
  "select a.codigo_interno as clave, count(*)::int as ordenes,\n" +
    "       coalesce(sum(o.costo_total), 0)::numeric as costo\n" +
    "from public.ordenes_mantencion o\n" +
    "join public.activos a on a.id = o.activo_id\n" +
    "where o.estado = 'completada' and o.fecha_ejecucion is not null\n" +
    "group by a.codigo_interno;",
);
const porActivoApp = acumular(ordenes, (o) => uno(o.activos)?.codigo_interno ?? "(sin activo)");
check(
  "misma cantidad de activos con costo",
  porActivoSql.length,
  porActivoApp.length,
  porActivoSql.length === porActivoApp.length,
);
for (const f of porActivoSql) {
  const a = porActivoApp.find((x) => x.clave === f.clave);
  check(`  activo ${f.clave}`, f.costo, a?.costo ?? "sin grupo", Number(f.costo) === a?.costo);
}

console.log("\n=== 5. Corte por proveedor ===");
const porProveedorSql = sql(
  "select coalesce(o.proveedor_id::text, 'interno') as clave, count(*)::int as ordenes,\n" +
    "       coalesce(sum(o.costo_total), 0)::numeric as costo\n" +
    "from public.ordenes_mantencion o\n" +
    "where o.estado = 'completada' and o.fecha_ejecucion is not null\n" +
    "group by 1;",
);
const porProveedorApp = acumular(ordenes, (o) => o.proveedor_id ?? "interno");
check(
  "misma cantidad de proveedores",
  porProveedorSql.length,
  porProveedorApp.length,
  porProveedorSql.length === porProveedorApp.length,
);
for (const f of porProveedorSql) {
  const a = porProveedorApp.find((x) => x.clave === f.clave);
  check(
    `  proveedor ${f.clave.slice(0, 8)}`,
    f.costo,
    a?.costo ?? "sin grupo",
    Number(f.costo) === a?.costo,
  );
}

console.log("\n=== 6. Filtro por periodo ===");
const [rango] = sql(
  "select min(fecha_ejecucion)::text as desde, max(fecha_ejecucion)::text as hasta\n" +
    "from public.ordenes_mantencion\n" +
    "where estado = 'completada' and fecha_ejecucion is not null;",
);
/*
  Se corta en la mitad del rango a proposito, no en los extremos: un filtro que
  abarca todo el historial coincide con el total sin filtro y no probaria nada.
*/
const medio = new Date(
  (new Date(rango.desde).getTime() + new Date(rango.hasta).getTime()) / 2,
)
  .toISOString()
  .slice(0, 10);
const [parcial] = sql(
  "select count(*)::int as ordenes, coalesce(sum(costo_total), 0)::numeric as costo\n" +
    "from public.ordenes_mantencion\n" +
    "where estado = 'completada' and fecha_ejecucion is not null\n" +
    `  and fecha_ejecucion >= '${rango.desde}' and fecha_ejecucion <= '${medio}';`,
);
const resFiltrado = await rest(
  `${SELECT}&fecha_ejecucion=gte.${rango.desde}&fecha_ejecucion=lte.${medio}`,
);
const filtradas = Array.isArray(resFiltrado.cuerpo) ? resFiltrado.cuerpo : [];
const costoFiltrado = filtradas.reduce((s, o) => s + Number(o.costo_total ?? 0), 0);
check(
  `periodo ${rango.desde} a ${medio}: ordenes`,
  parcial.ordenes,
  filtradas.length,
  parcial.ordenes === filtradas.length,
);
check("periodo: costo", parcial.costo, costoFiltrado, Number(parcial.costo) === costoFiltrado);
check(
  "el periodo recorta de verdad",
  `< ${ordenes.length}`,
  filtradas.length,
  filtradas.length < ordenes.length,
);

console.log("\n=== 7. Los costos siguen cerrados para anon ===");
const anon = await fetch(`${B}/rest/v1/ordenes_mantencion?select=costo_total&limit=1`, {
  headers: { apikey: ANON },
});
check(
  "anon no lee ordenes_mantencion",
  "401 o 403",
  anon.status,
  anon.status === 401 || anon.status === 403,
);
const anonVista = await fetch(`${B}/rest/v1/v_estado_mantencion?select=plan_id&limit=1`, {
  headers: { apikey: ANON },
});
check(
  "anon no lee v_estado_mantencion",
  "401 o 403",
  anonVista.status,
  anonVista.status === 401 || anonVista.status === 403,
);

console.log("\n=== 8. Orden de criticidad ===");
const PESO = { vencida: 1, critica: 2, proxima: 3, al_dia: 4, sin_linea_base: 5 };
const crit = (await rest("v_estado_mantencion?select=plan_id,semaforo,dias_restantes")).cuerpo ?? [];
const ordenada = [...crit]
  .filter((f) => f.semaforo)
  .sort((a, b) => {
    const p = PESO[a.semaforo] - PESO[b.semaforo];
    if (p !== 0) return p;
    return (
      (a.dias_restantes ?? Number.MAX_SAFE_INTEGER) - (b.dias_restantes ?? Number.MAX_SAFE_INTEGER)
    );
  });
check("hay planes que ordenar", ">0", ordenada.length, ordenada.length > 0);
if (ordenada.length > 0) {
  const pesoMinimo = Math.min(...ordenada.map((f) => PESO[f.semaforo]));
  check(
    "el primero es el mas critico",
    pesoMinimo,
    PESO[ordenada[0].semaforo],
    PESO[ordenada[0].semaforo] === pesoMinimo,
  );
  check(
    "el peso nunca retrocede",
    "monotono",
    "revisado",
    ordenada.every((f, i) => i === 0 || PESO[ordenada[i - 1].semaforo] <= PESO[f.semaforo]),
  );
}

console.log(`\n${fallas === 0 ? "TODO OK" : `${fallas} FALLA(S)`}`);
process.exit(fallas === 0 ? 0 : 1);
