#!/usr/bin/env node
/*
  Verifica, contra el sitio DESPLEGADO, el gasto en la ficha del activo y el
  puente que lleva de la ficha publica del QR al detalle privado.

  La comprobacion que mas importa es la 2: con el interruptor de costos
  publicos APAGADO, la ficha que abre el QR no puede mostrar ni un peso. No se
  revisa mirando la interfaz sino el HTML crudo que sale del servidor, porque
  un monto escondido con CSS igual viaja por la red y basta con abrir las
  herramientas del navegador para verlo.

  Es un script de SOLO LECTURA.

  Uso:
    NODE_EXTRA_CA_CERTS="$USERPROFILE/ca-windows.pem" node scripts/verifica-ficha-y-gasto.mjs
*/
import fs from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
  console.error("no pude iniciar sesion");
  process.exit(2);
}

const valor = "base64-" + Buffer.from(JSON.stringify(ses), "utf8").toString("base64");
const TROZO = 3180;
const nombre = `sb-${REF}-auth-token`;
const COOKIE = (
  valor.length <= TROZO
    ? [`${nombre}=${valor}`]
    : Array.from({ length: Math.ceil(valor.length / TROZO) }, (_, i) =>
        `${nombre}.${i}=${valor.slice(i * TROZO, (i + 1) * TROZO)}`,
      )
).join("; ");

const conSesion = (ruta, extra = {}) =>
  fetch(`${SITIO}${ruta}`, { headers: { Cookie: COOKIE }, ...extra });
const sinSesion = (ruta, extra = {}) => fetch(`${SITIO}${ruta}`, extra);

const rest = async (ruta) => {
  const r = await fetch(`${B}/rest/v1/${ruta}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ses.access_token}` },
  });
  return r.json();
};

let fallas = 0;
const check = (etiqueta, esperado, real, ok) => {
  if (!ok) fallas += 1;
  console.log(
    `  ${ok ? "OK   " : "FALLA"} ${etiqueta.padEnd(54)} esperado=${String(esperado).padEnd(14)} real=${real}`,
  );
};

/* Se elige la maquina con mas gasto: es la que mejor ejercita el grafico. */
const ordenes = await rest(
  "ordenes_mantencion?select=activo_id,costo_total&estado=eq.completada&fecha_ejecucion=not.is.null&limit=5000",
);
const porActivo = new Map();
for (const o of ordenes) {
  if (!o.activo_id) continue;
  porActivo.set(o.activo_id, (porActivo.get(o.activo_id) ?? 0) + Number(o.costo_total ?? 0));
}
const [activoId, totalEsperado] = [...porActivo.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
if (!activoId) {
  console.error("no hay activos con gasto con que probar");
  process.exit(2);
}

const [activo] = await rest(`activos?id=eq.${activoId}&select=codigo_interno,nombre,qr_token`);
console.log(`maquina de prueba: ${activo.codigo_interno} · ${activo.nombre}\n`);

const soloDigitos = (s) => Number(String(s).replace(/[^\d]/g, ""));

console.log("=== 1. La ficha privada muestra el gasto ===");
const priv = await conSesion(`/admin/activos/${activoId}`);
const htmlPriv = await priv.text();
check("responde 200", 200, priv.status, priv.status === 200);
check(
  "tiene la seccion de gasto",
  true,
  htmlPriv.includes("Gasto de mantención"),
  htmlPriv.includes("Gasto de mantención"),
);
check("tiene el grafico mensual", true, htmlPriv.includes("Gasto por mes"), htmlPriv.includes("Gasto por mes"));
check(
  "tiene el acumulado",
  true,
  htmlPriv.includes("Gasto acumulado"),
  htmlPriv.includes("Gasto acumulado"),
);
check(
  "tiene la tabla mes a mes",
  true,
  htmlPriv.includes("Ver los montos mes a mes"),
  htmlPriv.includes("Ver los montos mes a mes"),
);

const montos = new Set((htmlPriv.match(/\$[\s ]?[\d.]+/g) ?? []).map(soloDigitos));
check(
  "el total calza con la base",
  Math.round(totalEsperado),
  montos.has(Math.round(totalEsperado)) ? "presente" : "ausente",
  montos.has(Math.round(totalEsperado)),
);

console.log("\n=== 2. La ficha publica NO publica costos con el interruptor apagado ===");
const [config] = await rest("configuracion?select=mostrar_costos_publico");
console.log(`  mostrar_costos_publico = ${config.mostrar_costos_publico}`);

const pub = await sinSesion(`/a/${activo.qr_token}`);
const htmlPub = await pub.text();
check("la ficha publica responde 200 sin sesion", 200, pub.status, pub.status === 200);

if (config.mostrar_costos_publico) {
  console.log("  (el interruptor esta ENCENDIDO: se comprueba que el grafico si aparezca)");
  check(
    "aparece el gasto",
    true,
    htmlPub.includes("Gasto de mantención"),
    htmlPub.includes("Gasto de mantención"),
  );
  check(
    "y declara que calcula sobre esta ficha",
    true,
    htmlPub.includes("mantenciones que aparecen en esta ficha"),
    htmlPub.includes("mantenciones que aparecen en esta ficha"),
  );
} else {
  /*
    Se mira el HTML crudo y no la interfaz. Un monto escondido con CSS igual
    viaja por la red, y con abrir las herramientas del navegador se ve.
  */
  check(
    "no aparece la seccion de gasto",
    "ausente",
    htmlPub.includes("Gasto de mantención") ? "presente" : "ausente",
    !htmlPub.includes("Gasto de mantención"),
  );
  check(
    "no aparece ningun grafico de gasto",
    "ausente",
    htmlPub.includes("Gasto acumulado") ? "presente" : "ausente",
    !htmlPub.includes("Gasto acumulado"),
  );
  const simbolos = htmlPub.match(/\$[\s ]?[\d.]{3,}/g) ?? [];
  check(
    "no viaja ningun monto en el HTML",
    0,
    simbolos.length ? simbolos.join(" ") : 0,
    simbolos.length === 0,
  );
  check(
    "el total de la maquina no esta en el HTML",
    "ausente",
    htmlPub.includes(String(Math.round(totalEsperado))) ? "presente" : "ausente",
    !htmlPub.includes(String(Math.round(totalEsperado))),
  );
}

console.log("\n=== 3. El puente al detalle privado ===");
check(
  "la ficha publica ofrece el enlace",
  true,
  htmlPub.includes(`/admin/qr/${activo.qr_token}`),
  htmlPub.includes(`/admin/qr/${activo.qr_token}`),
);
check(
  "y explica que pide sesion",
  true,
  htmlPub.includes("Ver el detalle completo"),
  htmlPub.includes("Ver el detalle completo"),
);

const puenteAnon = await sinSesion(`/admin/qr/${activo.qr_token}`, { redirect: "manual" });
check(
  "sin sesion, el puente manda al login",
  "307 o 302",
  puenteAnon.status,
  puenteAnon.status === 307 || puenteAnon.status === 302,
);
const destinoAnon = puenteAnon.headers.get("location") ?? "";
check(
  "y el destino es /login",
  "/login",
  destinoAnon,
  destinoAnon.includes("/login"),
);

const puente = await conSesion(`/admin/qr/${activo.qr_token}`, { redirect: "manual" });
check(
  "con sesion, redirige",
  "307 o 302",
  puente.status,
  puente.status === 307 || puente.status === 302,
);
const destino = puente.headers.get("location") ?? "";
check(
  "a la ficha de ESA maquina",
  `/admin/activos/${activoId}`,
  destino,
  destino.includes(`/admin/activos/${activoId}`),
);

console.log("\n=== 4. Un token inventado no revela nada ===");
const inventado = "00000000-0000-4000-8000-000000000000";
const puenteFalso = await conSesion(`/admin/qr/${inventado}`, { redirect: "manual" });
check(
  "el puente responde 404",
  404,
  puenteFalso.status,
  puenteFalso.status === 404,
);
const fichaFalsa = await sinSesion(`/a/${inventado}`, { redirect: "manual" });
check(
  "y la ficha publica tambien",
  404,
  fichaFalsa.status,
  fichaFalsa.status === 404,
);

console.log("\n=== 5. anon sigue sin leer tablas base ===");
for (const tabla of ["ordenes_mantencion", "activos", "configuracion"]) {
  const r = await fetch(`${B}/rest/v1/${tabla}?select=*&limit=1`, { headers: { apikey: ANON } });
  check(`anon no lee ${tabla}`, "401 o 403", r.status, r.status === 401 || r.status === 403);
}

console.log(`\n${fallas === 0 ? "TODO OK" : `${fallas} FALLA(S)`}`);
process.exit(fallas === 0 ? 0 : 1);
