#!/usr/bin/env node
/*
  Verifica el borrado de activos contra la base real.

  Que se prueba: que solo un administrador pueda borrar, que la base impida
  borrar una maquina con mantenciones registradas, y que el borrado legitimo
  funcione y se lleve en cascada lo que corresponde.

  REGLA DE ESTE SCRIPT, aprendida a un costo alto: una prueba destructiva SOLO
  toca filas que ella misma creo. Nada de elegir "un activo cualquiera" con
  limit 1 para borrarlo. Todo lo que se crea aca lleva el codigo ZZ-VERIF y se
  borra al final; si el script muere a mitad de camino, queda una maquina con
  ese prefijo y se limpia a mano.

  Uso:
    NODE_EXTRA_CA_CERTS="$USERPROFILE/ca-windows.pem" node scripts/verifica-borrado-activos.mjs
*/
import fs from "node:fs";
import { homedir } from "node:os";
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

const lineas = fs
  .readFileSync(
    process.env.CREDENCIALES_DEMO ?? join(homedir(), "maquina-qr-credenciales-demo.txt"),
    "utf8",
  )
  .split(/\r?\n/);

async function sesion(correo) {
  const linea = lineas.find((l) => l.startsWith(correo));
  if (!linea) return null;
  const [email, password] = linea.trim().split(/\s+/);
  const r = await (
    await fetch(`${B}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  ).json();
  return r.access_token ?? null;
}

const rest = async (token, ruta, opciones = {}) => {
  const r = await fetch(`${B}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opciones.headers ?? {}),
    },
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
    `  ${ok ? "OK   " : "FALLA"} ${etiqueta.padEnd(52)} esperado=${String(esperado).padEnd(16)} real=${real}`,
  );
};

const tokenAdmin = await sesion("admin@demo.local");
const tokenTecnico = await sesion("tecnico@demo.local");
if (!tokenAdmin) {
  console.error("no pude iniciar sesion con la cuenta admin");
  process.exit(2);
}

const marca = `ZZ-VERIF-${Date.now().toString().slice(-6)}`;
let activoId = null;
let ordenId = null;

async function limpiar() {
  if (ordenId) await rest(tokenAdmin, `ordenes_mantencion?id=eq.${ordenId}`, { method: "DELETE" });
  if (activoId) await rest(tokenAdmin, `activos?id=eq.${activoId}`, { method: "DELETE" });
}

try {
  console.log("=== Preparacion ===");
  const tipos = (await rest(tokenAdmin, "tipos_activo?select=codigo&activo=eq.true&limit=1")).cuerpo;
  const tipoCodigo = Array.isArray(tipos) && tipos[0]?.codigo ? tipos[0].codigo : null;
  if (!tipoCodigo) {
    console.error("no hay tipos de activo con que crear la maquina de prueba");
    process.exit(2);
  }

  const creado = (
    await rest(tokenAdmin, "activos", {
      method: "POST",
      body: JSON.stringify({
        nombre: "Maquina de verificacion automatica",
        codigo_interno: marca,
        tipo_codigo: tipoCodigo,
        estado: "operativo",
      }),
    })
  ).cuerpo?.[0];

  check("se crea la maquina de prueba", marca, creado?.codigo_interno ?? "sin fila", Boolean(creado?.id));
  if (!creado?.id) process.exit(1);
  activoId = creado.id;
  console.log(`  ${marca} creada, id ${activoId}`);

  console.log("\n=== 1. Un tecnico no borra activos ===");
  if (!tokenTecnico) {
    console.log("  (omitido: no hay credenciales de tecnico@demo.local)");
  } else {
    const intento = await rest(tokenTecnico, `activos?id=eq.${activoId}`, { method: "DELETE" });
    /*
      El filtro SI calza con una fila que existe, asi que un cuerpo vacio no es
      "no habia nada que borrar": es RLS frenando la operacion. Ese es el punto
      de crear la fila primero.
    */
    check(
      "el tecnico no borra",
      "no vuelve fila",
      Array.isArray(intento.cuerpo) ? `${intento.cuerpo.length} fila(s)` : "sin cuerpo",
      !Array.isArray(intento.cuerpo) || intento.cuerpo.length === 0,
    );

    const sigue = (await rest(tokenAdmin, `activos?id=eq.${activoId}&select=id`)).cuerpo;
    check("y la maquina sigue existiendo", 1, sigue?.length ?? 0, sigue?.length === 1);
  }

  console.log("\n=== 2. Con mantenciones registradas, la base lo impide ===");
  const orden = (
    await rest(tokenAdmin, "ordenes_mantencion", {
      method: "POST",
      body: JSON.stringify({
        activo_id: activoId,
        tipo: "correctiva",
        estado: "programada",
        descripcion_trabajo: "ZZ-VERIF orden para probar la restriccion de borrado",
      }),
    })
  ).cuerpo?.[0];
  check("se crea una orden de prueba", "con folio", orden ? `folio ${orden.folio}` : "sin orden", Boolean(orden?.id));
  ordenId = orden?.id ?? null;

  const conHistorial = await rest(tokenAdmin, `activos?id=eq.${activoId}`, { method: "DELETE" });
  check(
    "el admin tampoco puede borrarla",
    "409",
    conHistorial.estado,
    conHistorial.estado === 409,
  );
  check(
    "y el motivo es la llave foranea",
    "23503",
    conHistorial.cuerpo?.code ?? "sin codigo",
    conHistorial.cuerpo?.code === "23503",
  );

  const intacta = (await rest(tokenAdmin, `activos?id=eq.${activoId}&select=id`)).cuerpo;
  check("la maquina sigue intacta", 1, intacta?.length ?? 0, intacta?.length === 1);

  console.log("\n=== 3. Sin mantenciones, el admin si la borra ===");
  await rest(tokenAdmin, `ordenes_mantencion?id=eq.${ordenId}`, { method: "DELETE" });
  ordenId = null;

  const borrada = await rest(tokenAdmin, `activos?id=eq.${activoId}`, { method: "DELETE" });
  check(
    "vuelve la fila borrada",
    marca,
    borrada.cuerpo?.[0]?.codigo_interno ?? "sin fila",
    borrada.cuerpo?.[0]?.codigo_interno === marca,
  );

  const buscada = (await rest(tokenAdmin, `activos?id=eq.${activoId}&select=id`)).cuerpo;
  check("ya no esta en la tabla", 0, buscada?.length ?? "sin cuerpo", buscada?.length === 0);
  activoId = null;

  console.log("\n=== 4. No quedaron restos con la marca ===");
  const restos = (await rest(tokenAdmin, `activos?codigo_interno=like.ZZ-VERIF*&select=codigo_interno`))
    .cuerpo;
  check(
    "ninguna maquina ZZ-VERIF en la tabla",
    0,
    Array.isArray(restos) ? restos.length : "sin cuerpo",
    Array.isArray(restos) && restos.length === 0,
  );
} finally {
  await limpiar();
}

console.log(`\n${fallas === 0 ? "TODO OK" : `${fallas} FALLA(S)`}`);
process.exit(fallas === 0 ? 0 : 1);
