#!/usr/bin/env node
/*
  Verifica la logica de negocio de mantenciones contra la base real.

  Lo que se prueba es que la base haga su trabajo sin que la aplicacion se lo
  pida: al agregar una linea de repuesto, un trigger tiene que descontar stock,
  recalcular monto_repuestos de la orden y dejar costo_total al dia, porque es
  columna generada. Si eso lo hiciera la aplicacion, cualquier otro cliente que
  escriba en la base dejaria el inventario inconsistente.

  Todo lo que crea lo borra al final. Si el script muere a mitad de camino,
  quedan una orden y sus movimientos con la marca ZZ-VERIF en la descripcion.

  Uso:
    NODE_EXTRA_CA_CERTS="$USERPROFILE/ca-windows.pem" node scripts/verifica-mantenciones.mjs
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

const H = {
  apikey: ANON,
  Authorization: `Bearer ${ses.access_token}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const rest = async (ruta, opciones = {}) => {
  const r = await fetch(`${B}/rest/v1/${ruta}`, { ...opciones, headers: { ...H, ...(opciones.headers ?? {}) } });
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
  console.log(`  ${ok ? "OK   " : "FALLA"} ${etiqueta.padEnd(50)} esperado=${String(esperado).padEnd(16)} real=${real}`);
};

console.log("=== Preparacion ===");
const activo = (await rest("activos?select=id,codigo_interno&limit=1")).cuerpo?.[0];
const repuesto = (await rest("repuestos?select=id,nombre,stock_actual,costo_unitario_referencia&limit=1")).cuerpo?.[0];
if (!activo || !repuesto) {
  console.error("no hay activos o repuestos con que probar");
  process.exit(2);
}
const stockInicial = Number(repuesto.stock_actual);
console.log(`  activo ${activo.codigo_interno}, repuesto ${repuesto.nombre}, stock inicial ${stockInicial}`);

console.log("\n=== 1. Crear la orden ===");
const creada = (
  await rest("ordenes_mantencion", {
    method: "POST",
    body: JSON.stringify({
      activo_id: activo.id,
      tipo: "correctiva",
      estado: "en_ejecucion",
      descripcion_trabajo: "ZZ-VERIF prueba automatica de triggers",
      monto_mano_obra: 50000,
      monto_otros: 10000,
    }),
  })
).cuerpo?.[0];

check("orden creada", "con folio", creada ? `folio ${creada.folio}` : "sin orden", Boolean(creada?.id));
if (!creada) process.exit(1);

check(
  "costo_total al crear, sin repuestos",
  "60000",
  creada.costo_total,
  Number(creada.costo_total) === 60000,
);
check("monto_repuestos al crear", "0", creada.monto_repuestos, Number(creada.monto_repuestos) === 0);

console.log("\n=== 2. Agregar una linea de repuesto ===");
const CANTIDAD = 2;
const COSTO = 15000;
const lineaCreada = (
  await rest("orden_repuestos", {
    method: "POST",
    body: JSON.stringify({
      orden_id: creada.id,
      repuesto_id: repuesto.id,
      cantidad: CANTIDAD,
      costo_unitario: COSTO,
    }),
  })
).cuerpo?.[0];

check("linea creada", "con subtotal", lineaCreada ? `subtotal ${lineaCreada.subtotal}` : "sin linea", Boolean(lineaCreada?.id));
check(
  "subtotal es columna generada",
  String(CANTIDAD * COSTO),
  lineaCreada?.subtotal,
  Number(lineaCreada?.subtotal) === CANTIDAD * COSTO,
);

const ordenTrasLinea = (await rest(`ordenes_mantencion?select=monto_repuestos,costo_total&id=eq.${creada.id}`)).cuerpo?.[0];
check(
  "el trigger recalculo monto_repuestos",
  String(CANTIDAD * COSTO),
  ordenTrasLinea?.monto_repuestos,
  Number(ordenTrasLinea?.monto_repuestos) === CANTIDAD * COSTO,
);
check(
  "costo_total se movio solo",
  String(60000 + CANTIDAD * COSTO),
  ordenTrasLinea?.costo_total,
  Number(ordenTrasLinea?.costo_total) === 60000 + CANTIDAD * COSTO,
);

const repuestoTrasLinea = (await rest(`repuestos?select=stock_actual&id=eq.${repuesto.id}`)).cuerpo?.[0];
check(
  "el trigger descontó stock",
  String(stockInicial - CANTIDAD),
  repuestoTrasLinea?.stock_actual,
  Number(repuestoTrasLinea?.stock_actual) === stockInicial - CANTIDAD,
);

const movimientos = (await rest(`movimientos_stock?select=tipo,cantidad&orden_id=eq.${creada.id}`)).cuerpo ?? [];
check(
  "quedo registrado el movimiento de consumo",
  "1 de tipo consumo",
  `${movimientos.length} de tipo ${movimientos[0]?.tipo ?? "-"}`,
  movimientos.length === 1 && movimientos[0]?.tipo === "consumo",
);

console.log("\n=== 3. Eliminar la linea revierte todo ===");
await rest(`orden_repuestos?id=eq.${lineaCreada.id}`, { method: "DELETE" });

const ordenTrasBorrar = (await rest(`ordenes_mantencion?select=monto_repuestos,costo_total&id=eq.${creada.id}`)).cuerpo?.[0];
check("monto_repuestos volvio a cero", "0", ordenTrasBorrar?.monto_repuestos, Number(ordenTrasBorrar?.monto_repuestos) === 0);
check("costo_total volvio a 60000", "60000", ordenTrasBorrar?.costo_total, Number(ordenTrasBorrar?.costo_total) === 60000);

const repuestoFinal = (await rest(`repuestos?select=stock_actual&id=eq.${repuesto.id}`)).cuerpo?.[0];
check("el stock volvio a su valor inicial", String(stockInicial), repuestoFinal?.stock_actual, Number(repuestoFinal?.stock_actual) === stockInicial);

console.log("\n=== 4. movimientos_stock es append only ===");
const movs = (await rest(`movimientos_stock?select=id&orden_id=eq.${creada.id}`)).cuerpo ?? [];
if (movs.length > 0) {
  const borrado = await fetch(`${B}/rest/v1/movimientos_stock?id=eq.${movs[0].id}`, {
    method: "DELETE",
    headers: { ...H, Prefer: "return=representation" },
  });
  const filas = await borrado.json().catch(() => []);
  check(
    "ni el admin puede borrar un movimiento",
    "0 filas borradas",
    `${Array.isArray(filas) ? filas.length : "?"} filas`,
    Array.isArray(filas) && filas.length === 0,
  );
} else {
  check("quedaron movimientos que auditar", "al menos 1", "0", false);
}

console.log("\n=== Limpieza ===");
const borradoOrden = await rest(`ordenes_mantencion?id=eq.${creada.id}`, { method: "DELETE" });
console.log(`  orden de prueba eliminada: HTTP ${borradoOrden.estado}`);
const quedan = (await rest(`ordenes_mantencion?select=id&descripcion_trabajo=like.*ZZ-VERIF*`)).cuerpo ?? [];
console.log(`  ordenes con marca ZZ-VERIF que quedan: ${Array.isArray(quedan) ? quedan.length : "?"}`);

console.log(`\n=== ${fallas === 0 ? "TODO OK" : fallas + " FALLA(S)"} ===`);
process.exit(fallas === 0 ? 0 : 1);
