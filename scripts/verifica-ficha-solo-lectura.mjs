#!/usr/bin/env node
/*
  Verifica que la ficha publica del QR sea de SOLO LECTURA. Sin excepciones.

  Por que esto es un test y no un comentario en el codigo: la ruta /a/ esta
  EXCLUIDA del matcher de src/proxy.ts, y eso es seguro por una sola razon, que
  esa ruta no invoca ninguna Server Function. Un matcher que excluye una ruta
  tambien excluye las Server Functions que se invoquen desde ella. El dia que
  alguien agregue un boton con una accion a esa pantalla, la exclusion pasa de
  ser una optimizacion a ser un agujero, y no habria nada que lo delate.

  Este script lo delata. Recorre el arbol de imports de la pagina publica de
  verdad, en vez de mirar una lista escrita a mano que se queda vieja.

  Tres capas, porque cada una atrapa un error distinto:
   1. Estatica: la pantalla publica no tiene formularios, ni Server Actions, ni
      importa ningun modulo de acciones.
   2. Base de datos: el rol anon no puede escribir en ninguna tabla, ni
      ejecutar ninguna funcion que no sean las dos permitidas.
   3. Servida: el HTML que sale a internet no trae un formulario ni referencia
      a una Server Action.

  Es un script de SOLO LECTURA sobre datos: los intentos de escritura se hacen
  con la llave anonima y tienen que fallar. Si alguno tuviera exito, el script
  falla ruidosamente, que es justo lo que se quiere saber.

  Uso:
    NODE_EXTRA_CA_CERTS="$USERPROFILE/ca-windows.pem" node scripts/verifica-ficha-solo-lectura.mjs
*/
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
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

let fallas = 0;
const check = (etiqueta, esperado, real, ok) => {
  if (!ok) fallas += 1;
  console.log(
    `  ${ok ? "OK   " : "FALLA"} ${etiqueta.padEnd(52)} esperado=${String(esperado).padEnd(14)} real=${real}`,
  );
};

const sql = (texto) => {
  const archivo = join(tmpdir(), `verifica-solo-lectura-${process.pid}.sql`);
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

/* ── Capa 1: estatica, recorriendo el arbol de imports de verdad ─────────── */

const EXTENSIONES = [".tsx", ".ts"];

function resuelve(especificador, desde) {
  let base;
  if (especificador.startsWith("@/")) base = join(RAIZ, "src", especificador.slice(2));
  else if (especificador.startsWith(".")) base = resolve(dirname(desde), especificador);
  else return null; // paquete de node_modules, no es codigo del proyecto

  for (const ext of ["", ...EXTENSIONES]) {
    const candidato = base + ext;
    if (fs.existsSync(candidato) && fs.statSync(candidato).isFile()) return candidato;
  }
  for (const ext of EXTENSIONES) {
    const indice = join(base, `index${ext}`);
    if (fs.existsSync(indice)) return indice;
  }
  return null;
}

function arbolDeImports(entrada) {
  const vistos = new Set();
  const pendientes = [entrada];
  while (pendientes.length > 0) {
    const archivo = pendientes.pop();
    if (vistos.has(archivo)) continue;
    vistos.add(archivo);
    const texto = fs.readFileSync(archivo, "utf8");
    const especificadores = [...texto.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    for (const e of especificadores) {
      const destino = resuelve(e, archivo);
      if (destino) pendientes.push(destino);
    }
  }
  return [...vistos];
}

console.log("=== 1. La pantalla publica no tiene superficie de escritura ===");

const entrada = join(RAIZ, "src", "app", "a", "[token]", "page.tsx");
const arbol = arbolDeImports(entrada);
console.log(`  ${arbol.length} archivos en el arbol de imports de /a/[token]`);

/*
  error.tsx es la unica excepcion permitida y no se llega a el por un import:
  Next lo monta como limite de error, tiene que ser Client Component por
  contrato del framework, y su unica interaccion es volver a renderizar.
*/
const limiteError = join(RAIZ, "src", "app", "a", "[token]", "error.tsx");
const aRevisar = fs.existsSync(limiteError) ? [...arbol, limiteError] : arbol;

const relativa = (f) => f.replace(RAIZ + "\\", "").replace(RAIZ + "/", "").replace(/\\/g, "/");

const PROHIBIDO = [
  { patron: /"use server"|'use server'/, que: "directiva use server" },
  { patron: /<form\b/, que: "elemento form" },
  { patron: /useActionState|useFormState/, que: "hook de accion de formulario" },
  { patron: /from\s+["'][^"']*acciones["']/, que: "import de un modulo de acciones" },
  { patron: /\.(insert|update|upsert|delete)\s*\(/, que: "escritura directa a la base" },
  { patron: /method\s*=\s*["']post["']/i, que: "formulario con metodo POST" },
];

for (const archivo of aRevisar) {
  const texto = fs.readFileSync(archivo, "utf8");
  const encontrados = PROHIBIDO.filter((p) => p.patron.test(texto)).map((p) => p.que);
  check(
    `  ${relativa(archivo)}`,
    "sin escritura",
    encontrados.length ? encontrados.join(", ") : "sin escritura",
    encontrados.length === 0,
  );
}

/*
  Cero JavaScript de cliente en el camino normal. error.tsx queda fuera del
  conteo porque el framework lo exige, y solo se monta cuando ya hubo una falla.
*/
const clientes = arbol.filter((f) => /^\s*["']use client["']/.test(fs.readFileSync(f, "utf8")));
check(
  "ningun Client Component en el arbol",
  0,
  clientes.length ? clientes.map(relativa).join(", ") : 0,
  clientes.length === 0,
);

if (fs.existsSync(limiteError)) {
  const texto = fs.readFileSync(limiteError, "utf8");
  const soloReintenta = /onClick=\{reset\}/.test(texto) && !/fetch\(|acciones/.test(texto);
  check(
    "error.tsx solo reintenta el render",
    "solo reset",
    soloReintenta ? "solo reset" : "hace algo mas",
    soloReintenta,
  );
}

/* ── Capa 2: la base no deja escribir a anon ─────────────────────────────── */

console.log("\n=== 2. El rol anon no puede escribir en ninguna tabla ===");

const tablas = sql(
  "select c.relname as tabla\n" +
    "from pg_class c join pg_namespace n on n.oid = c.relnamespace\n" +
    "where n.nspname = 'public' and c.relkind = 'r'\n" +
    "order by c.relname;",
);

const permisos = sql(
  "select c.relname as tabla,\n" +
    "  has_table_privilege('anon', 'public.' || quote_ident(c.relname), 'select') as lee,\n" +
    "  has_table_privilege('anon', 'public.' || quote_ident(c.relname), 'insert') as inserta,\n" +
    "  has_table_privilege('anon', 'public.' || quote_ident(c.relname), 'update') as actualiza,\n" +
    "  has_table_privilege('anon', 'public.' || quote_ident(c.relname), 'delete') as borra\n" +
    "from pg_class c join pg_namespace n on n.oid = c.relnamespace\n" +
    "where n.nspname = 'public' and c.relkind = 'r'\n" +
    "order by c.relname;",
);

console.log(`  ${tablas.length} tablas en el schema public`);
const conEscritura = permisos.filter((p) => p.inserta || p.actualiza || p.borra);
check(
  "ninguna tabla acepta escritura de anon",
  0,
  conEscritura.length
    ? conEscritura.map((p) => `${p.tabla}(${[p.inserta && "I", p.actualiza && "U", p.borra && "D"].filter(Boolean).join("")})`).join(" ")
    : 0,
  conEscritura.length === 0,
);

const conLectura = permisos.filter((p) => p.lee);
check(
  "ninguna tabla base la lee anon",
  0,
  conLectura.length ? conLectura.map((p) => p.tabla).join(" ") : 0,
  conLectura.length === 0,
);

console.log("\n=== 3. anon solo ejecuta las dos funciones permitidas ===");
const PERMITIDAS = ["get_ficha_publica", "credenciales_demo"];
const funciones = sql(
  "select p.proname as funcion,\n" +
    "  pg_get_function_identity_arguments(p.oid) as firma,\n" +
    "  has_function_privilege('anon', p.oid, 'execute') as ejecuta\n" +
    "from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n" +
    "where n.nspname = 'public'\n" +
    "order by p.proname;",
);
const ejecutables = funciones.filter((f) => f.ejecuta);
console.log(`  ${funciones.length} funciones en public, ${ejecutables.length} ejecutables por anon`);
for (const f of ejecutables) {
  check(
    `  anon ejecuta ${f.funcion}`,
    "permitida",
    PERMITIDAS.includes(f.funcion) ? "permitida" : "NO DEBERIA",
    PERMITIDAS.includes(f.funcion),
  );
}
check(
  "ninguna funcion de escritura al alcance de anon",
  "0 no permitidas",
  ejecutables.filter((f) => !PERMITIDAS.includes(f.funcion)).length,
  ejecutables.every((f) => PERMITIDAS.includes(f.funcion)),
);

/* ── Capa 3: intentos reales de escritura con la llave anonima ───────────── */

console.log("\n=== 4. Intentos reales de escritura con la llave anonima ===");
const intento = async (metodo, ruta, cuerpo) => {
  const r = await fetch(`${B}/rest/v1/${ruta}`, {
    method: metodo,
    headers: { apikey: ANON, "Content-Type": "application/json", Prefer: "return=representation" },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  return r.status;
};

for (const [etiqueta, metodo, ruta, cuerpo] of [
  ["INSERT en lecturas_uso", "POST", "lecturas_uso", { horometro: 1 }],
  ["UPDATE en activos", "PATCH", "activos?codigo_interno=neq.zzz", { nombre: "hackeado" }],
  ["DELETE en activos", "DELETE", "activos?codigo_interno=neq.zzz", null],
  ["INSERT en ordenes_mantencion", "POST", "ordenes_mantencion", { tipo: "correctiva" }],
  ["UPDATE en configuracion", "PATCH", "configuracion?id=eq.true", { mostrar_costos_publico: true }],
  ["DELETE en movimientos_stock", "DELETE", "movimientos_stock?cantidad=neq.0", null],
]) {
  const estado = await intento(metodo, ruta, cuerpo);
  check(`  ${etiqueta}`, "401 o 403", estado, estado === 401 || estado === 403);
}

/* ── Capa 4: el HTML que sale a internet ─────────────────────────────────── */

console.log("\n=== 5. El HTML servido no trae superficie de escritura ===");
const [muestra] = sql(
  "select qr_token::text as token from public.activos\n" +
    "where estado <> 'dado_de_baja' order by codigo_interno limit 1;",
);
if (!muestra?.token) {
  console.log("  (no hay activos publicables con que probar)");
} else {
  const r = await fetch(`${SITIO}/a/${muestra.token}`);
  const html = await r.text();
  check("la ficha responde 200 sin sesion", 200, r.status, r.status === 200);
  check("no hay elemento form", "ausente", /<form\b/i.test(html) ? "presente" : "ausente", !/<form\b/i.test(html));
  check(
    "no hay boton de envio",
    "ausente",
    /type="submit"/i.test(html) ? "presente" : "ausente",
    !/type="submit"/i.test(html),
  );
  /*
    Next serializa la referencia a una Server Action como un id en el payload.
    Si aparece, alguien conecto una mutacion a esta pantalla.
  */
  check(
    "no hay referencia a una Server Action",
    "ausente",
    /\$ACTION_ID_|next-action/i.test(html) ? "presente" : "ausente",
    !/\$ACTION_ID_|next-action/i.test(html),
  );
  check(
    "el enlace al panel privado si esta",
    "presente",
    html.includes("/admin/qr/") ? "presente" : "ausente",
    html.includes("/admin/qr/"),
  );
}

console.log(`\n${fallas === 0 ? "TODO OK" : `${fallas} FALLA(S)`}`);
process.exit(fallas === 0 ? 0 : 1);
