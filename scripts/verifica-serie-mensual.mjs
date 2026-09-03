#!/usr/bin/env node
/*
  Pruebas de la aritmetica de la serie mensual de gasto.

  Por que existen: src/lib/serie-mensual.ts lo usan TRES pantallas con origenes
  de datos distintos (el resumen del panel, la ficha privada de cada activo y la
  ficha publica que abre el QR). Un error de un mes ahi se ve igual en las tres
  y no lo delata ninguna consulta a la base, porque el defecto esta en el
  calculo y no en el dato.

  El modulo no importa nada, asi que se puede compilar solo y probar en
  aislamiento. Eso es exactamente por lo que se separo del modulo de consultas.

  Uso:
    node scripts/verifica-serie-mensual.mjs
*/
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const salida = mkdtempSync(join(tmpdir(), "serie-mensual-"));

/*
  Se compila el archivo suelto con tsc. No se usa el tsconfig del proyecto a
  proposito: trae rutas con alias y JSX que este modulo no necesita, y el punto
  es probarlo tal como es, sin dependencias.
*/
const compilacion = spawnSync(
  "npx",
  [
    "tsc",
    join(RAIZ, "src", "lib", "serie-mensual.ts"),
    "--outDir",
    salida,
    "--module",
    "esnext",
    "--target",
    "es2022",
    "--moduleResolution",
    "bundler",
    "--strict",
  ],
  { encoding: "utf8", shell: true },
);

if (compilacion.status !== 0) {
  console.error("no pude compilar serie-mensual.ts");
  console.error(compilacion.stdout || compilacion.stderr);
  process.exit(2);
}

const mod = await import(pathToFileURL(join(salida, "serie-mensual.js")).href);
const { armaSerieMensual, etiquetaMes, mesSiguiente, mesDeFecha } = mod;

let fallas = 0;
const check = (etiqueta, esperado, real) => {
  const ok = JSON.stringify(esperado) === JSON.stringify(real);
  if (!ok) fallas += 1;
  console.log(
    `  ${ok ? "OK   " : "FALLA"} ${etiqueta.padEnd(56)} esperado=${JSON.stringify(esperado)} real=${JSON.stringify(real)}`,
  );
};

console.log("=== 1. mesSiguiente ===");
check("dentro del ano", "2026-04", mesSiguiente("2026-03"));
check("cruce de diciembre a enero", "2027-01", mesSiguiente("2026-12"));
check("rellena a dos digitos", "2026-10", mesSiguiente("2026-09"));
check("de enero a febrero", "2026-02", mesSiguiente("2026-01"));

console.log("\n=== 2. etiquetaMes ===");
check("mes normal", "mar 26", etiquetaMes("2026-03"));
check("diciembre", "dic 25", etiquetaMes("2025-12"));
check("enero", "ene 26", etiquetaMes("2026-01"));
/* Una clave invalida devuelve la clave y no "undefined NaN" en pantalla. */
check("clave invalida se devuelve tal cual", "basura", etiquetaMes("basura"));
check("mes 13 se devuelve tal cual", "2026-13", etiquetaMes("2026-13"));

console.log("\n=== 3. mesDeFecha: el mes NO se corre por zona horaria ===");
/*
  Esta es la razon de que la funcion exista. new Date("2026-03-01") se
  interpreta como medianoche UTC, y leido en horario de Chile eso es el 28 de
  febrero: la orden cambiaria de mes. Se compara contra ese calculo para dejar
  la diferencia a la vista.
*/
const porDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
check("primero de marzo", "2026-03", mesDeFecha("2026-03-01"));
console.log(`         (new Date daria ${porDate("2026-03-01")} en esta maquina)`);
check("primero de enero", "2026-01", mesDeFecha("2026-01-01"));
console.log(`         (new Date daria ${porDate("2026-01-01")} en esta maquina)`);
check("fecha con hora", "2026-07", mesDeFecha("2026-07-15T10:30:00Z"));
check("fecha corrupta", null, mesDeFecha("no-es-fecha"));
check("mes fuera de rango", null, mesDeFecha("2026-00-10"));
check("mes 13", null, mesDeFecha("2026-13-10"));

console.log("\n=== 4. armaSerieMensual: rellena los meses sin gasto ===");
/*
  Un mes sin gasto tiene que aparecer con cero. Si se omitiera, dos meses
  separados por un ano de inactividad quedarian pegados en el grafico y la
  serie contaria una historia falsa sobre el ritmo del gasto.
*/
const conHueco = armaSerieMensual(
  [
    { mes: "2026-01", monto: 100 },
    { mes: "2026-04", monto: 300 },
  ],
  24,
);
check("cuatro columnas, no dos", 4, conHueco.puntos.length);
check(
  "los meses van completos",
  ["2026-01", "2026-02", "2026-03", "2026-04"],
  conHueco.puntos.map((p) => p.mes),
);
check("los huecos valen cero", [100, 0, 0, 300], conHueco.puntos.map((p) => p.monto));
check("el acumulado arrastra", [100, 100, 100, 400], conHueco.puntos.map((p) => p.acumulado));

console.log("\n=== 5. Cruce de ano en el relleno ===");
const cruzaAno = armaSerieMensual(
  [
    { mes: "2025-11", monto: 50 },
    { mes: "2026-02", monto: 50 },
  ],
  24,
);
check(
  "diciembre y enero aparecen",
  ["2025-11", "2025-12", "2026-01", "2026-02"],
  cruzaAno.puntos.map((p) => p.mes),
);

console.log("\n=== 6. El acumulado se calcula ANTES de recortar ===");
/*
  Si se calculara despues del recorte, el primer mes visible partiria en cero y
  diria que la maquina no habia gastado nada antes, que es falso.
*/
const recortada = armaSerieMensual(
  [
    { mes: "2026-01", monto: 1000 },
    { mes: "2026-02", monto: 10 },
    { mes: "2026-03", monto: 20 },
  ],
  2,
);
check("se muestran solo dos meses", 2, recortada.puntos.length);
check("los ultimos dos", ["2026-02", "2026-03"], recortada.puntos.map((p) => p.mes));
check("el acumulado NO parte de cero", [1010, 1030], recortada.puntos.map((p) => p.acumulado));
check("declara cuantos meses quedaron fuera", 1, recortada.recortados);

console.log("\n=== 7. Varias ordenes en el mismo mes se suman ===");
const mismoMes = armaSerieMensual(
  [
    { mes: "2026-05", monto: 100 },
    { mes: "2026-05", monto: 250 },
    { mes: "2026-05", monto: 50 },
  ],
  24,
);
check("una sola columna", 1, mismoMes.puntos.length);
check("con la suma", 400, mismoMes.puntos[0].monto);

console.log("\n=== 8. Casos borde ===");
check("sin movimientos", { puntos: [], recortados: 0, truncadaPorSeguridad: false }, armaSerieMensual([], 24));
check(
  "solo claves invalidas",
  { puntos: [], recortados: 0, truncadaPorSeguridad: false },
  armaSerieMensual([{ mes: "basura", monto: 100 }], 24),
);
const mezcla = armaSerieMensual(
  [
    { mes: "basura", monto: 999 },
    { mes: "2026-06", monto: 100 },
  ],
  24,
);
check("la clave invalida se descarta y la buena queda", [100], mezcla.puntos.map((p) => p.monto));
check("montos en cero no rompen", 1, armaSerieMensual([{ mes: "2026-06", monto: 0 }], 24).puntos.length);
check("tope cero devuelve todo", 2, armaSerieMensual(
  [
    { mes: "2026-06", monto: 1 },
    { mes: "2026-07", monto: 1 },
  ],
  0,
).puntos.length);
check("desordenado se ordena solo", ["2026-06", "2026-07"], armaSerieMensual(
  [
    { mes: "2026-07", monto: 1 },
    { mes: "2026-06", monto: 1 },
  ],
  24,
).puntos.map((p) => p.mes));

console.log("\n=== 9. El cinturon de seguridad del relleno ===");
/*
  Un rango absurdo no puede colgar el servidor ni devolver una serie infinita.
  Se corta a 600 meses y lo DECLARA, para que quien lo muestre pueda avisar en
  vez de dibujar un grafico incompleto como si fuera completo.
*/
const absurda = armaSerieMensual(
  [
    { mes: "1900-01", monto: 10 },
    { mes: "2100-01", monto: 10 },
  ],
  100000,
);
check("no genera mas de 600 columnas", true, absurda.puntos.length <= 600);
check("y lo declara", true, absurda.truncadaPorSeguridad);

rmSync(salida, { recursive: true, force: true });

console.log(`\n${fallas === 0 ? "TODO OK" : `${fallas} FALLA(S)`}`);
process.exit(fallas === 0 ? 0 : 1);
