#!/usr/bin/env node
/*
  Verifica el ciclo completo de un activo: crear, editar, borrar, y el borrado
  bloqueado cuando tiene historial.

  REGLA DE ESTE ARCHIVO, aprendida rompiendo datos de verdad: una prueba
  destructiva SOLO toca filas que ella misma creo. La version anterior de esta
  verificacion eligio "un activo con mantenciones" con un limit 1 sin comprobar
  que las tuviera, le toco justo el unico sin historial, y lo borro de la base de
  demostracion junto con sus tres planes. Hubo que restaurarlo desde el seed.

  Por eso aca el caso "no se puede borrar" se construye: se crea un activo, se le
  crea una orden, se intenta borrar, y despues se limpia en orden inverso.

  Uso:
    NODE_EXTRA_CA_CERTS="$USERPROFILE/ca-windows.pem" node scripts/verifica-activos.mjs
*/
import fs from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

/*
  Se usa la cuenta que la propia aplicacion publica, no una de administrador
  guardada aparte. Asi la prueba responde la pregunta que importa: puede la
  cuenta demo hacer esto.
*/
const cred = await (
  await fetch(`${B}/rest/v1/rpc/credenciales_demo`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: "{}",
  })
).json();

if (!cred?.email) {
  console.error("la funcion credenciales_demo no devolvio credenciales: la demo esta apagada");
  process.exit(2);
}

const ses = await (
  await fetch(`${B}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify(cred),
  })
).json();

if (!ses.access_token) {
  console.error("no pude iniciar sesion con la cuenta de demostracion");
  process.exit(2);
}

const H = {
  apikey: ANON,
  Authorization: `Bearer ${ses.access_token}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const rest = async (ruta, opciones = {}) => {
  const r = await fetch(`${B}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { ...H, ...(opciones.headers ?? {}) },
  });
  let cuerpo = null;
  try {
    cuerpo = await r.json();
  } catch {
    /* 204 */
  }
  return { estado: r.status, cuerpo };
};

let fallas = 0;
const check = (etiqueta, esperado, real, ok) => {
  if (!ok) fallas += 1;
  console.log(
    `  ${ok ? "OK   " : "FALLA"} ${etiqueta.padEnd(50)} esperado=${String(esperado).padEnd(18)} real=${real}`,
  );
};

// Sufijo derivado del token de sesion, no de un reloj ni de un aleatorio, para
// que dos corridas seguidas no choquen por codigo_interno duplicado.
const sufijo = ses.access_token.slice(-6).replace(/[^a-zA-Z0-9]/g, "X");
const creados = { activos: [], ordenes: [] };

console.log(`=== cuenta usada: ${cred.email} ===\n`);

try {
  console.log("=== 1. Crear ===");
  const cre = await rest("activos", {
    method: "POST",
    body: JSON.stringify({
      nombre: "ZZ activo de verificacion automatica",
      codigo_interno: `ZZ-VER-${sufijo}`,
      tipo_codigo: "tractor",
      estado: "operativo",
    }),
  });
  const activo = Array.isArray(cre.cuerpo) ? cre.cuerpo[0] : null;
  check("crear activo", "201 con id", `${cre.estado} ${activo ? "con id" : "sin id"}`, Boolean(activo?.id));
  if (!activo) {
    console.error(JSON.stringify(cre.cuerpo).slice(0, 300));
    process.exit(1);
  }
  creados.activos.push(activo.id);

  check(
    "la base genero el qr_token",
    "un uuid",
    activo.qr_token ? activo.qr_token.slice(0, 8) + "..." : "ninguno",
    Boolean(activo.qr_token),
  );

  const ficha = await (
    await fetch(`${B}/rest/v1/rpc/get_ficha_publica`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: activo.qr_token }),
    })
  ).json();
  check(
    "su ficha publica ya responde",
    activo.codigo_interno,
    ficha?.activo?.codigo_interno ?? "null",
    ficha?.activo?.codigo_interno === activo.codigo_interno,
  );

  console.log("\n=== 2. Editar ===");
  const edi = await rest(`activos?id=eq.${activo.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      nombre: "ZZ activo editado",
      ubicacion: "Fundo de verificacion",
      horometro_actual: 123.5,
    }),
  });
  const editado = Array.isArray(edi.cuerpo) ? edi.cuerpo[0] : null;
  check("editar nombre y ubicacion", "nombre nuevo", editado?.nombre ?? edi.estado, editado?.nombre === "ZZ activo editado");
  check(
    "el qr_token NO cambia al editar",
    activo.qr_token.slice(0, 8),
    (editado?.qr_token ?? "").slice(0, 8),
    editado?.qr_token === activo.qr_token,
  );

  console.log("\n=== 3. Con historial, el borrado se bloquea ===");
  const orden = await rest("ordenes_mantencion", {
    method: "POST",
    body: JSON.stringify({
      activo_id: activo.id,
      tipo: "correctiva",
      estado: "en_ejecucion",
      descripcion_trabajo: "ZZ-VERIF orden para probar el bloqueo de borrado",
    }),
  });
  const filaOrden = Array.isArray(orden.cuerpo) ? orden.cuerpo[0] : null;
  check("crear una orden para ese activo", "201", `${orden.estado}`, Boolean(filaOrden?.id));
  if (filaOrden) creados.ordenes.push(filaOrden.id);

  const bloqueado = await rest(`activos?id=eq.${activo.id}`, { method: "DELETE" });
  const borradas = Array.isArray(bloqueado.cuerpo) ? bloqueado.cuerpo.length : "?";
  check(
    "borrar el activo con la orden encima",
    "rechazado por la base",
    `${bloqueado.estado} ${bloqueado.cuerpo?.code ?? borradas}`,
    bloqueado.estado >= 400,
  );

  console.log("\n=== 4. Sin historial, el borrado procede ===");
  await rest(`ordenes_mantencion?id=eq.${filaOrden.id}`, { method: "DELETE" });
  creados.ordenes = [];

  const bor = await rest(`activos?id=eq.${activo.id}`, { method: "DELETE" });
  const n = Array.isArray(bor.cuerpo) ? bor.cuerpo.length : 0;
  check("borrar el activo ya sin ordenes", "1 fila borrada", `${bor.estado}, ${n} fila(s)`, n === 1);
  if (n === 1) creados.activos = [];

  const tras = await (
    await fetch(`${B}/rest/v1/rpc/get_ficha_publica`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: activo.qr_token }),
    })
  ).json();
  check("su ficha publica deja de existir", "null", JSON.stringify(tras), tras === null);
} finally {
  // Limpieza en orden inverso, incluso si algo revento a mitad de camino.
  for (const id of creados.ordenes) await rest(`ordenes_mantencion?id=eq.${id}`, { method: "DELETE" });
  for (const id of creados.activos) await rest(`activos?id=eq.${id}`, { method: "DELETE" });

  const residuo = (await rest("activos?select=codigo_interno&codigo_interno=like.ZZ-VER-*")).cuerpo;
  console.log(
    `\n  residuo de la prueba: ${Array.isArray(residuo) ? residuo.length : "?"} activos ZZ-VER (deberia ser 0)`,
  );
}

console.log(`\n=== ${fallas === 0 ? "TODO OK" : fallas + " FALLA(S)"} ===`);
process.exit(fallas === 0 ? 0 : 1);
