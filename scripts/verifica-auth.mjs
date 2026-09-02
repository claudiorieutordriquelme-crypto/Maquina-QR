#!/usr/bin/env node
/*
  Verifica el modelo de autorizacion contra la base real, sin navegador.

  Inicia sesion de verdad contra el servidor de Auth y usa el access token para
  comprobar que cada rol puede exactamente lo que debe. Las pruebas negativas
  son las que importan: que un boton este oculto no prueba nada, lo que prueba
  algo es que la base rechace la operacion.

  Trampa que costo una version de este archivo: un DELETE o un UPDATE cuyo
  filtro no calza con ninguna fila devuelve 204 aunque RLS lo bloquee, porque
  RLS filtra las filas afectadas y no queda ninguna. Probar con un id
  inexistente no mide nada. Aca se usan filas reales y la cabecera
  Prefer: return=representation, que devuelve las filas efectivamente
  modificadas: arreglo vacio significa bloqueado, con contenido significa que
  paso.

  El borrado no se prueba por comportamiento, porque la unica prueba concluyente
  seria destructiva. Se verifica estructuralmente con SQL: si una tabla no tiene
  politica de DELETE ni de ALL, nadie borra, sin importar el rol. Eso es lo que
  hace que movimientos_stock sea append only de verdad.

    node scripts/sql-remoto.mjs consulta-politicas.sql

  Uso:
    node scripts/verifica-auth.mjs

  Requiere .env.local en la raiz del proyecto y un archivo de credenciales de
  prueba fuera del repo, una linea por cuenta con "correo password". Su ruta se
  toma de CREDENCIALES_DEMO o, por defecto, ~/maquina-qr-credenciales-demo.txt

  En la red corporativa hay que confiar la CA del proxy, o toda llamada falla
  con TypeError: fetch failed. Ver el README.
    NODE_EXTRA_CA_CERTS="$USERPROFILE/ca-windows.pem" node scripts/verifica-auth.mjs
*/
import fs from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

function leerEnvLocal() {
  const texto = fs.readFileSync(join(RAIZ, ".env.local"), "utf8");
  const mapa = {};
  for (const linea of texto.split(/\r?\n/)) {
    const i = linea.indexOf("=");
    if (i > 0 && !linea.trimStart().startsWith("#")) {
      mapa[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
    }
  }
  return mapa;
}

const env = leerEnvLocal();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_BASE || !ANON) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  process.exit(2);
}

const rutaCredenciales =
  process.env.CREDENCIALES_DEMO ?? join(homedir(), "maquina-qr-credenciales-demo.txt");

let credenciales;
try {
  credenciales = fs
    .readFileSync(rutaCredenciales, "utf8")
    .split(/\r?\n/)
    .filter((l) => /\S+@\S+\s+\S+/.test(l))
    .map((l) => {
      // Solo el primer token despues del correo. Antes se unian todos los
      // restantes, y un comentario al final de la linea terminaba pegado dentro
      // de la contraseña, con el resultado de un "Invalid login credentials"
      // que parecia un problema de la base y era del parser.
      const [email, password] = l.trim().split(/\s+/);
      return { email, password };
    });
} catch {
  console.error(`No pude leer las credenciales de prueba en ${rutaCredenciales}.`);
  console.error("Formato: una linea por cuenta, \"correo password\". Nunca dentro del repo.");
  process.exit(2);
}

const ROL_ESPERADO = {
  "admin@demo.local": "admin",
  "tecnico@demo.local": "tecnico",
  "lector@demo.local": "lector",
};

async function entrar({ email, password }) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  return { ok: r.ok, token: j.access_token ?? null, detalle: j.error_description ?? j.msg ?? "" };
}

/** Solo para filtrar por el propio usuario. No valida la firma, no hace falta. */
function sujeto(token) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8")).sub;
}

async function rest(ruta, token, opciones = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...(opciones.headers ?? {}),
    },
  });
  let cuerpo = null;
  try {
    cuerpo = await r.json();
  } catch {
    /* 204 no trae cuerpo */
  }
  return { estado: r.status, cuerpo };
}

const REPRESENTACION = { headers: { Prefer: "return=representation" } };
let fallas = 0;

function linea(etiqueta, esperado, real, ok) {
  if (!ok) fallas += 1;
  console.log(
    `  ${ok ? "OK   " : "FALLA"} ${etiqueta.padEnd(52)} esperado=${String(esperado).padEnd(22)} real=${real}`,
  );
}

const sesiones = {};

console.log("=== 1. Inicio de sesion real contra el servidor de Auth ===");
for (const c of credenciales) {
  const s = await entrar(c);
  sesiones[c.email] = s.token;
  linea(`login ${c.email}`, "token", s.ok ? "token recibido" : `error: ${s.detalle}`, s.ok);
}

console.log("\n=== 2. Cada cuenta lee SU perfil y trae el rol que le corresponde ===");
for (const c of credenciales) {
  const t = sesiones[c.email];
  if (!t) continue;
  const r = await rest(`profiles?select=nombre,rol,activo&user_id=eq.${sujeto(t)}`, t);
  const fila = Array.isArray(r.cuerpo) ? r.cuerpo[0] : null;
  const rol = fila?.rol ?? "-";
  const esperado = ROL_ESPERADO[c.email] ?? rol;
  linea(c.email, esperado, `rol=${rol} activo=${fila?.activo}`, rol === esperado);
}

console.log("\n=== 3. anon no lee ninguna tabla ni vista. Regla numero uno ===");
for (const ruta of [
  "activos?select=nombre",
  "v_estado_mantencion?select=semaforo",
  "profiles?select=rol",
  "ordenes_mantencion?select=folio",
  "movimientos_stock?select=cantidad",
]) {
  const r = await rest(ruta, null);
  const bloqueado = r.estado === 401 || r.estado === 403;
  linea(`anon lee ${ruta.split("?")[0]}`, "401 o 403", String(r.estado), bloqueado);
}

console.log("\n=== 4. Pruebas negativas de escritura, sobre filas reales ===");

const tAdmin = sesiones["admin@demo.local"];
const refActivo = await rest("activos?select=id,codigo_interno,notas&limit=1", tAdmin);
const activo = Array.isArray(refActivo.cuerpo) ? refActivo.cuerpo[0] : null;

if (!activo) {
  console.log("  no pude leer un activo de referencia, se omiten las pruebas de escritura");
  fallas += 1;
} else {
  // Se reescribe notas con su propio valor: si la politica dejara pasar el
  // update, el dato igual no cambia. La prueba es informativa, no destructiva.
  const cuerpoUpdate = JSON.stringify({ notas: activo.notas });

  for (const cuenta of ["lector@demo.local", "tecnico@demo.local"]) {
    const t = sesiones[cuenta];
    if (!t) continue;
    const r = await rest(`activos?id=eq.${activo.id}`, t, {
      method: "PATCH",
      body: cuerpoUpdate,
      ...REPRESENTACION,
    });
    const afectadas = Array.isArray(r.cuerpo) ? r.cuerpo.length : "?";
    linea(`${cuenta} modifica un activo`, "0 filas", `${r.estado}, ${afectadas} fila(s)`, afectadas === 0);
  }

  const rAdmin = await rest(`activos?id=eq.${activo.id}`, tAdmin, {
    method: "PATCH",
    body: cuerpoUpdate,
    ...REPRESENTACION,
  });
  const afectadasAdmin = Array.isArray(rAdmin.cuerpo) ? rAdmin.cuerpo.length : "?";
  linea("admin modifica un activo", "1 fila", `${rAdmin.estado}, ${afectadasAdmin} fila(s)`, afectadasAdmin === 1);

  const tLector = sesiones["lector@demo.local"];
  if (tLector) {
    const r = await rest("ordenes_mantencion", tLector, {
      method: "POST",
      body: JSON.stringify({
        activo_id: activo.id,
        tipo: "correctiva",
        descripcion_trabajo: "prueba de politica, no debe insertarse",
      }),
    });
    linea("lector inserta una orden", "401 o 403", `${r.estado} ${r.cuerpo?.code ?? ""}`, r.estado === 401 || r.estado === 403);
  }
}

const tTecnico = sesiones["tecnico@demo.local"];
if (tTecnico) {
  const r = await rest("proveedores", tTecnico, {
    method: "POST",
    body: JSON.stringify({ nombre: "Proveedor de prueba que no debe crearse" }),
  });
  linea("tecnico crea un proveedor", "401 o 403", `${r.estado} ${r.cuerpo?.code ?? ""}`, r.estado === 401 || r.estado === 403);
}

console.log(`\n=== ${fallas === 0 ? "TODO OK" : fallas + " FALLA(S)"} ===`);
process.exit(fallas === 0 ? 0 : 1);
