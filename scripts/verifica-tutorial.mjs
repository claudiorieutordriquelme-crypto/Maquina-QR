#!/usr/bin/env node
/*
  Verifica que el recorrido guiado siga anclado a la interfaz real.

  El problema que resuelve: cada paso del tutorial destaca un elemento por su
  atributo data-tour. Si alguien renombra ese atributo o borra el elemento, el
  paso no lanza ningun error: el recorrido cae a una tarjeta centrada y sigue
  andando, pero pierde exactamente lo que lo hace util. Es una falla silenciosa,
  y las fallas silenciosas necesitan un chequeo explicito.

  Comprueba dos direcciones:
    1. Toda ancla que un paso pide existe en el codigo.
    2. Todo data-tour del codigo lo usa algun paso. Los huerfanos son ruido:
       marcan un elemento que nadie destaca y confunden al siguiente que lea.

  No necesita red ni base de datos: es analisis estatico del arbol src.

  Uso:
    node scripts/verifica-tutorial.mjs
*/
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RAIZ, "src");
const PASOS = join(SRC, "lib", "tutorial", "pasos.ts");

function archivosDe(directorio) {
  const salida = [];
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivosDe(ruta));
    else if (/\.(tsx?|jsx?)$/.test(entrada)) salida.push(ruta);
  }
  return salida;
}

const fuentePasos = readFileSync(PASOS, "utf8");

/* Anclas que pide el recorrido, con el paso al que pertenecen. */
const pedidas = new Map();
const bloques = fuentePasos.split(/\n  \{\n/).slice(1);
for (const bloque of bloques) {
  const id = bloque.match(/id: "([^"]+)"/)?.[1] ?? "(sin id)";
  const ancla = bloque.match(/ancla: "([^"]+)"/)?.[1];
  if (ancla) pedidas.set(ancla, id);
}

/* Anclas que existen en el codigo, con el archivo donde viven. */
const existentes = new Map();
for (const archivo of archivosDe(SRC)) {
  /*
    Se excluye el propio motor del tutorial: ahi el data-tour aparece dentro de
    un querySelector con interpolacion, no como atributo de un elemento, y el
    escaneo lo leia como un ancla huerfana llamada literalmente "${paso.ancla}".
  */
  if (archivo.includes(join("lib", "tutorial"))) continue;
  if (archivo.includes(join("components", "tutorial"))) continue;
  const texto = readFileSync(archivo, "utf8");
  for (const m of texto.matchAll(/data-tour="([^"]+)"/g)) {
    existentes.set(m[1], archivo.replace(RAIZ + "\\", "").replace(RAIZ + "/", ""));
  }
}

const pasosTotales = (fuentePasos.match(/^    id: "/gm) || []).length;
const sinAncla = pasosTotales - pedidas.size;

console.log(`=== Recorrido guiado ===`);
console.log(`  pasos: ${pasosTotales} (${pedidas.size} anclados, ${sinAncla} centrados a proposito)`);
console.log(`  anclas declaradas en el codigo: ${existentes.size}`);

let fallas = 0;

console.log(`\n=== 1. Cada paso anclado encuentra su elemento ===`);
for (const [ancla, paso] of pedidas) {
  const donde = existentes.get(ancla);
  if (donde) {
    console.log(`  OK    ${paso.padEnd(22)} -> data-tour="${ancla}"  en ${donde}`);
  } else {
    fallas += 1;
    console.log(`  FALLA ${paso.padEnd(22)} -> data-tour="${ancla}"  NO EXISTE en el codigo`);
  }
}

console.log(`\n=== 2. Ningun data-tour queda huerfano ===`);
const huerfanas = [...existentes.keys()].filter((a) => !pedidas.has(a));
if (huerfanas.length === 0) {
  console.log(`  OK    las ${existentes.size} anclas del codigo estan en uso`);
} else {
  for (const a of huerfanas) {
    fallas += 1;
    console.log(`  FALLA data-tour="${a}" en ${existentes.get(a)} no lo usa ningun paso`);
  }
}

console.log(`\n=== 3. Las rutas de los pasos existen como pagina ===`);
const rutas = [...new Set([...fuentePasos.matchAll(/ruta: "([^"]+)"/g)].map((m) => m[1]))];
for (const ruta of rutas) {
  const relativa = ruta === "/admin" ? "admin" : ruta.replace(/^\//, "");
  const pagina = join(SRC, "app", ...relativa.split("/"), "page.tsx");
  try {
    statSync(pagina);
    console.log(`  OK    ${ruta}`);
  } catch {
    fallas += 1;
    console.log(`  FALLA ${ruta} no tiene page.tsx en ${pagina.replace(RAIZ, "")}`);
  }
}

console.log(`\n=== ${fallas === 0 ? "TODO OK" : fallas + " FALLA(S)"} ===`);
process.exit(fallas === 0 ? 0 : 1);
