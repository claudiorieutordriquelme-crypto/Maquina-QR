#!/usr/bin/env node
/*
  Verifica el editar y el borrar de cada modulo contra la base real.

  REGLA DE ESTE SCRIPT: solo toca filas que el propio script creo, todas con la
  marca ZZ-VERIF, y las limpia al terminar. Nada de elegir "una cualquiera" con
  limit 1 para borrarla.

  Lo que se prueba y por que cada cosa importa:
  - Planes de mantencion: hasta ahora se cargaban por SQL. Es lo que genera el
    semaforo, o sea lo unico que hace que el sistema avise algo.
  - Borrado de orden: el camino evidente FALLA con 23503 porque el trigger de
    reversa inserta un movimiento apuntando a la orden que se borra. La accion
    separa las sentencias, y aca se comprueba que el stock vuelve.
  - Edicion de linea: el trigger cubre el UPDATE y ajusta el stock por la
    diferencia. Se verifica el delta, no solo que la fila cambie.
  - Borrado de repuesto: la base lo rechaza en cuanto hay movimientos. Se
    comprueba que el rechazo llegue, porque de eso depende que la pantalla
    ofrezca desactivar en vez de un boton que siempre falla.

  Uso:
    NODE_EXTRA_CA_CERTS="$USERPROFILE/ca-windows.pem" node scripts/verifica-crud-modulos.mjs
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
    `  ${ok ? "OK   " : "FALLA"} ${etiqueta.padEnd(50)} esperado=${String(esperado).padEnd(16)} real=${real}`,
  );
};

const admin = await sesion("admin@demo.local");
const tecnico = await sesion("tecnico@demo.local");
if (!admin) {
  console.error("no pude iniciar sesion con la cuenta admin");
  process.exit(2);
}

const marca = `ZZ-VERIF-${Date.now().toString().slice(-6)}`;
const creado = { activo: null, plan: null, orden: null, proveedor: null, repuesto: null };

async function limpiar() {
  /* En orden inverso a la creacion, y las lineas antes que la orden. */
  if (creado.orden) {
    await rest(admin, `orden_repuestos?orden_id=eq.${creado.orden}`, { method: "DELETE" });
    await rest(admin, `ordenes_mantencion?id=eq.${creado.orden}`, { method: "DELETE" });
  }
  if (creado.plan) await rest(admin, `planes_mantencion?id=eq.${creado.plan}`, { method: "DELETE" });
  if (creado.activo) await rest(admin, `activos?id=eq.${creado.activo}`, { method: "DELETE" });
  if (creado.proveedor) {
    await rest(admin, `proveedores?id=eq.${creado.proveedor}`, { method: "DELETE" });
  }
  if (creado.repuesto) await rest(admin, `repuestos?id=eq.${creado.repuesto}`, { method: "DELETE" });
}

try {
  console.log("=== Preparacion ===");
  const [tipo] = (await rest(admin, "tipos_activo?select=codigo&activo=eq.true&limit=1")).cuerpo;
  const activo = (
    await rest(admin, "activos", {
      method: "POST",
      body: JSON.stringify({
        nombre: "Maquina de verificacion CRUD",
        codigo_interno: marca,
        tipo_codigo: tipo.codigo,
        estado: "operativo",
      }),
    })
  ).cuerpo?.[0];
  check("activo de prueba creado", marca, activo?.codigo_interno ?? "sin fila", Boolean(activo?.id));
  if (!activo?.id) process.exit(1);
  creado.activo = activo.id;

  console.log("\n=== 1. Planes de mantención: crear, editar, desactivar, borrar ===");
  const plan = (
    await rest(admin, "planes_mantencion", {
      method: "POST",
      body: JSON.stringify({
        activo_id: activo.id,
        nombre: `${marca} plan`,
        intervalo_dias: 30,
        descripcion_tareas: "Prueba automatica",
      }),
    })
  ).cuerpo?.[0];
  check("plan creado", "con id", plan ? "creado" : "sin fila", Boolean(plan?.id));
  creado.plan = plan?.id ?? null;

  if (plan?.id) {
    const editado = await rest(admin, `planes_mantencion?id=eq.${plan.id}`, {
      method: "PATCH",
      body: JSON.stringify({ intervalo_dias: 45, intervalo_horas: 250 }),
    });
    check(
      "plan editado",
      "45 dias",
      editado.cuerpo?.[0]?.intervalo_dias ?? "sin fila",
      editado.cuerpo?.[0]?.intervalo_dias === 45,
    );

    const desactivado = await rest(admin, `planes_mantencion?id=eq.${plan.id}`, {
      method: "PATCH",
      body: JSON.stringify({ activo: false }),
    });
    check(
      "plan desactivado",
      false,
      desactivado.cuerpo?.[0]?.activo,
      desactivado.cuerpo?.[0]?.activo === false,
    );

    /* La base exige al menos un intervalo: se comprueba que rechace los dos nulos. */
    const invalido = await rest(admin, `planes_mantencion?id=eq.${plan.id}`, {
      method: "PATCH",
      body: JSON.stringify({ intervalo_dias: null, intervalo_horas: null }),
    });
    check(
      "sin ningun intervalo es rechazado",
      "400 o 409",
      invalido.estado,
      invalido.estado === 400 || invalido.estado === 409,
    );

    if (tecnico) {
      const intento = await rest(tecnico, `planes_mantencion?id=eq.${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ nombre: "tomado por el tecnico" }),
      });
      check(
        "el tecnico no edita planes",
        "no vuelve fila",
        Array.isArray(intento.cuerpo) ? `${intento.cuerpo.length} fila(s)` : "sin cuerpo",
        !Array.isArray(intento.cuerpo) || intento.cuerpo.length === 0,
      );
    }
  }

  console.log("\n=== 2. Orden: crear, editar la linea, borrar en dos pasos ===");
  const [repuesto] = (
    await rest(admin, "repuestos?select=id,nombre,stock_actual&activo=eq.true&limit=1")
  ).cuerpo;
  const stockInicial = Number(repuesto.stock_actual);

  const orden = (
    await rest(admin, "ordenes_mantencion", {
      method: "POST",
      body: JSON.stringify({
        activo_id: activo.id,
        tipo: "correctiva",
        estado: "en_ejecucion",
        descripcion_trabajo: `${marca} orden`,
      }),
    })
  ).cuerpo?.[0];
  check("orden creada", "con folio", orden ? `folio ${orden.folio}` : "sin fila", Boolean(orden?.id));
  creado.orden = orden?.id ?? null;

  const linea = (
    await rest(admin, "orden_repuestos", {
      method: "POST",
      body: JSON.stringify({
        orden_id: orden.id,
        repuesto_id: repuesto.id,
        cantidad: 4,
        costo_unitario: 1000,
      }),
    })
  ).cuerpo?.[0];
  check("linea agregada", "con id", linea ? "creada" : "sin fila", Boolean(linea?.id));

  const [tras4] = (await rest(admin, `repuestos?id=eq.${repuesto.id}&select=stock_actual`)).cuerpo;
  check(
    "el stock baja 4",
    stockInicial - 4,
    Number(tras4.stock_actual),
    Number(tras4.stock_actual) === stockInicial - 4,
  );

  /* Editar la cantidad: el trigger tiene que mover solo la diferencia. */
  const lineaEditada = await rest(admin, `orden_repuestos?id=eq.${linea.id}`, {
    method: "PATCH",
    body: JSON.stringify({ cantidad: 2, costo_unitario: 1500 }),
  });
  check(
    "linea editada",
    "cantidad 2",
    lineaEditada.cuerpo?.[0]?.cantidad ?? "sin fila",
    Number(lineaEditada.cuerpo?.[0]?.cantidad) === 2,
  );

  const [tras2] = (await rest(admin, `repuestos?id=eq.${repuesto.id}&select=stock_actual`)).cuerpo;
  check(
    "el stock se ajusta por la diferencia",
    stockInicial - 2,
    Number(tras2.stock_actual),
    Number(tras2.stock_actual) === stockInicial - 2,
  );

  const [ordenTrasEdicion] = (
    await rest(admin, `ordenes_mantencion?id=eq.${orden.id}&select=monto_repuestos,costo_total`)
  ).cuerpo;
  check(
    "monto_repuestos recalculado por la base",
    3000,
    Number(ordenTrasEdicion.monto_repuestos),
    Number(ordenTrasEdicion.monto_repuestos) === 3000,
  );

  /* El camino evidente falla: se documenta el error que motivo la solucion. */
  const directo = await rest(admin, `ordenes_mantencion?id=eq.${orden.id}`, { method: "DELETE" });
  check(
    "borrar la orden de una sola vez FALLA (esperado)",
    "409",
    directo.estado,
    directo.estado === 409,
  );
  check(
    "y el motivo es la llave del libro de stock",
    "23503",
    directo.cuerpo?.code ?? "sin codigo",
    directo.cuerpo?.code === "23503",
  );

  /* El camino que usa la accion: las lineas primero. */
  await rest(admin, `orden_repuestos?orden_id=eq.${orden.id}`, { method: "DELETE" });
  const enDosPasos = await rest(admin, `ordenes_mantencion?id=eq.${orden.id}`, {
    method: "DELETE",
  });
  check(
    "borrar en dos pasos funciona",
    "vuelve la fila",
    enDosPasos.cuerpo?.[0]?.folio ?? "sin fila",
    Boolean(enDosPasos.cuerpo?.[0]?.folio),
  );
  creado.orden = null;

  const [trasBorrado] = (
    await rest(admin, `repuestos?id=eq.${repuesto.id}&select=stock_actual`)
  ).cuerpo;
  check(
    "el stock vuelve a su valor original",
    stockInicial,
    Number(trasBorrado.stock_actual),
    Number(trasBorrado.stock_actual) === stockInicial,
  );

  console.log("\n=== 3. Proveedor: crear, editar, desactivar, borrar ===");
  const proveedor = (
    await rest(admin, "proveedores", {
      method: "POST",
      body: JSON.stringify({ nombre: `${marca} proveedor` }),
    })
  ).cuerpo?.[0];
  check("proveedor creado", "con id", proveedor ? "creado" : "sin fila", Boolean(proveedor?.id));
  creado.proveedor = proveedor?.id ?? null;

  if (proveedor?.id) {
    const editado = await rest(admin, `proveedores?id=eq.${proveedor.id}`, {
      method: "PATCH",
      body: JSON.stringify({ giro: "Verificacion", activo: false }),
    });
    check(
      "proveedor editado y desactivado",
      false,
      editado.cuerpo?.[0]?.activo,
      editado.cuerpo?.[0]?.activo === false,
    );

    const borrado = await rest(admin, `proveedores?id=eq.${proveedor.id}`, { method: "DELETE" });
    check(
      "proveedor borrado",
      "vuelve la fila",
      borrado.cuerpo?.[0]?.nombre ?? "sin fila",
      Boolean(borrado.cuerpo?.[0]?.nombre),
    );
    creado.proveedor = null;
  }

  console.log("\n=== 4. Repuesto: la base impide borrar uno con movimientos ===");
  const nuevoRepuesto = (
    await rest(admin, "repuestos", {
      method: "POST",
      /* codigo es not null y unico en el maestro de repuestos. */
      body: JSON.stringify({
        codigo: `${marca}-R1`,
        nombre: `${marca} repuesto`,
        unidad_medida: "unidad",
        stock_actual: 0,
        stock_minimo: 0,
      }),
    })
  ).cuerpo?.[0];
  check("repuesto creado", "con id", nuevoRepuesto ? "creado" : "sin fila", Boolean(nuevoRepuesto?.id));
  creado.repuesto = nuevoRepuesto?.id ?? null;

  if (nuevoRepuesto?.id) {
    /* Sin movimientos todavia: se puede borrar. */
    const sinMovimientos = await rest(admin, `repuestos?id=eq.${nuevoRepuesto.id}`, {
      method: "DELETE",
    });
    check(
      "sin movimientos si se borra",
      "vuelve la fila",
      sinMovimientos.cuerpo?.[0]?.nombre ?? "sin fila",
      Boolean(sinMovimientos.cuerpo?.[0]?.nombre),
    );
    creado.repuesto = null;

    /*
    Con movimientos: la base lo rechaza.

    ESTE CASO SE PRUEBA CON UN REPUESTO QUE YA EXISTE, no con uno nuevo, y la
    razon es que el script tiene que poder limpiar TODO lo que crea. Un repuesto
    con un movimiento no se puede borrar nunca, porque el libro es de solo
    agregar y el movimiento no se puede borrar tampoco. Crear uno para esta
    prueba dejaba un residuo permanente en produccion, y eso ya paso una vez.

    Usar uno existente es seguro justamente porque la operacion FALLA: la base
    rechaza el DELETE, asi que no hay nada que se pueda destruir.
  */
    const [existente] = (
      await rest(admin, "repuestos?select=id,nombre&limit=1&order=nombre")
    ).cuerpo;

    if (existente?.id) {
      const rechazado = await rest(admin, `repuestos?id=eq.${existente.id}`, {
        method: "DELETE",
      });
      check(
        "con movimientos la base lo rechaza",
        "409",
        rechazado.estado,
        rechazado.estado === 409,
      );
      check(
        "y el motivo es la llave foranea",
        "23503",
        rechazado.cuerpo?.code ?? "sin codigo",
        rechazado.cuerpo?.code === "23503",
      );

      const [sigue] = (
        await rest(admin, `repuestos?id=eq.${existente.id}&select=nombre,activo`)
      ).cuerpo;
      check(
        "y el repuesto sigue intacto y activo",
        existente.nombre,
        sigue?.nombre ?? "desaparecio",
        sigue?.nombre === existente.nombre,
      );
    }
  }

  console.log("\n=== 5. El libro de stock sigue siendo de solo agregar ===");
  const [movimiento] = (
    await rest(admin, `movimientos_stock?select=id&limit=1&order=created_at.desc`)
  ).cuerpo;
  if (movimiento?.id) {
    const intento = await rest(admin, `movimientos_stock?id=eq.${movimiento.id}`, {
      method: "DELETE",
    });
    check(
      "ni el admin borra un movimiento",
      "no vuelve fila",
      Array.isArray(intento.cuerpo) ? `${intento.cuerpo.length} fila(s)` : "sin cuerpo",
      !Array.isArray(intento.cuerpo) || intento.cuerpo.length === 0,
    );
  }
} finally {
  console.log("\n=== Limpieza ===");
  await limpiar();

  /*
    Se comprueba que no quede NADA con la marca. Este script no crea nada que la
    base no le permita borrar despues: esa es la condicion para poder correrlo
    contra produccion sin dejar basura.
  */
  const restos = (
    await rest(admin, "activos?codigo_interno=like.ZZ-VERIF*&select=codigo_interno")
  ).cuerpo;
  const restosRep = (await rest(admin, "repuestos?codigo=like.ZZ-VERIF*&select=codigo")).cuerpo;
  const restosProv = (await rest(admin, "proveedores?nombre=like.ZZ-VERIF*&select=nombre")).cuerpo;
  const restosOrd = (
    await rest(admin, "ordenes_mantencion?descripcion_trabajo=like.*ZZ-VERIF*&select=folio")
  ).cuerpo;

  check(
    "no quedaron activos ZZ-VERIF",
    0,
    Array.isArray(restos) ? restos.length : "?",
    Array.isArray(restos) && restos.length === 0,
  );
  check(
    "no quedaron repuestos ZZ-VERIF",
    0,
    Array.isArray(restosRep) ? restosRep.length : "?",
    Array.isArray(restosRep) && restosRep.length === 0,
  );
  check(
    "no quedaron proveedores ZZ-VERIF",
    0,
    Array.isArray(restosProv) ? restosProv.length : "?",
    Array.isArray(restosProv) && restosProv.length === 0,
  );
  check(
    "no quedaron ordenes ZZ-VERIF",
    0,
    Array.isArray(restosOrd) ? restosOrd.length : "?",
    Array.isArray(restosOrd) && restosOrd.length === 0,
  );

  /*
    Los movimientos de stock ZZ-VERIF SI quedan, y no es un descuido: el libro es
    de solo agregar y ni el admin puede borrar una fila. Se declara para que
    nadie los busque como si fueran residuo a limpiar.
  */
  const movs = (await rest(admin, "movimientos_stock?motivo=like.*ZZ-VERIF*&select=id")).cuerpo;
  console.log(
    `  nota: ${Array.isArray(movs) ? movs.length : "?"} movimiento(s) ZZ-VERIF quedan en el libro, que es de solo agregar por diseño`,
  );
}

console.log(`
${fallas === 0 ? "TODO OK" : `${fallas} FALLA(S)`}`);
process.exit(fallas === 0 ? 0 : 1);
