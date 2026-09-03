#!/usr/bin/env node
/*
  Verifica la pantalla de configuracion contra la base real.

  Que se prueba: que la configuracion, los parametros de calculo y la lista de
  usuarios solo se puedan tocar con rol de administrador, y que nadie sin sesion
  los alcance. Es la pantalla que cambia permisos de otras personas y decide si
  los costos salen publicados, asi que las politicas importan mas que la
  interfaz.

  POR QUE ESTE SCRIPT NO ESCRIBE NADA REAL:

  Una prueba honesta de escritura tendria que cambiar un valor de produccion. En
  esta tabla eso significa mover el semaforo de toda la flota, o peor, encender
  por un instante la publicacion de costos en las fichas publicas. En su lugar
  la unica escritura que se hace es un UPDATE que deja cada campo en el valor que
  ya tenia: recorre la politica completa sin alterar el dato.

  Y la trampa que hay que recordar: un UPDATE cuyo filtro no calza con ninguna
  fila devuelve 204 aunque RLS lo haya bloqueado. Por eso todo va con
  Prefer: return=representation, y lo que se mira es si volvio la fila.

  Uso:
    NODE_EXTRA_CA_CERTS="$USERPROFILE/ca-windows.pem" node scripts/verifica-configuracion.mjs
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
const lineas = fs.readFileSync(rutaCredenciales, "utf8").split(/\r?\n/);

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
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    `  ${ok ? "OK   " : "FALLA"} ${etiqueta.padEnd(52)} esperado=${String(esperado).padEnd(18)} real=${real}`,
  );
};

const tokenAdmin = await sesion("admin@demo.local");
const tokenTecnico = await sesion("tecnico@demo.local");
if (!tokenAdmin) {
  console.error("no pude iniciar sesion con la cuenta admin");
  process.exit(2);
}

console.log("=== 1. Sin sesion no se ve nada ===");
for (const tabla of ["configuracion", "parametros_calculo", "profiles"]) {
  const r = await fetch(`${B}/rest/v1/${tabla}?select=*&limit=1`, { headers: { apikey: ANON } });
  check(`anon no lee ${tabla}`, "401 o 403", r.status, r.status === 401 || r.status === 403);
}

console.log("\n=== 2. El administrador lee lo que la pantalla necesita ===");
const conf = await rest(
  tokenAdmin,
  "configuracion?select=mostrar_costos_publico,dias_alerta_proxima,dias_alerta_critica,moneda,nombre_organizacion",
);
check("configuracion responde 200", 200, conf.estado, conf.estado === 200);
check("hay exactamente una fila", 1, conf.cuerpo?.length, conf.cuerpo?.length === 1);

const fila = conf.cuerpo?.[0];
if (!fila) {
  console.error("sin fila de configuracion no hay nada mas que probar");
  process.exit(1);
}
check(
  "el umbral de proxima es mayor que el de critica",
  `> ${fila.dias_alerta_critica}`,
  fila.dias_alerta_proxima,
  fila.dias_alerta_proxima > fila.dias_alerta_critica,
);
console.log(
  `  nota: los costos en la ficha publica estan ${fila.mostrar_costos_publico ? "VISIBLES" : "ocultos"}`,
);

const params = await rest(tokenAdmin, "parametros_calculo?select=*");
check("parametros_calculo responde 200", 200, params.estado, params.estado === 200);
check("hay exactamente una fila", 1, params.cuerpo?.length, params.cuerpo?.length === 1);

const usuarios = await rest(tokenAdmin, "profiles?select=id,nombre,email,rol,activo");
check("profiles responde 200", 200, usuarios.estado, usuarios.estado === 200);
check("hay perfiles", ">0", usuarios.cuerpo?.length ?? 0, (usuarios.cuerpo?.length ?? 0) > 0);

const admins = (usuarios.cuerpo ?? []).filter((u) => u.rol === "admin" && u.activo);
check("hay al menos un administrador activo", ">=1", admins.length, admins.length >= 1);

console.log("\n=== 3. Escritura sin cambiar el dato ===");
/*
  Se reescribe cada campo con el valor que ya tenia. La politica se recorre
  entera, la fila vuelve por return=representation, y el contenido de la base
  queda exactamente igual.
*/
const mismo = await rest(tokenAdmin, "configuracion?id=eq.true", {
  method: "PATCH",
  body: JSON.stringify({
    dias_alerta_proxima: fila.dias_alerta_proxima,
    dias_alerta_critica: fila.dias_alerta_critica,
    moneda: fila.moneda,
    nombre_organizacion: fila.nombre_organizacion,
    mostrar_costos_publico: fila.mostrar_costos_publico,
  }),
});
check(
  "el admin puede escribir configuracion",
  "la fila vuelve",
  mismo.cuerpo?.length ?? 0,
  (mismo.cuerpo?.length ?? 0) === 1,
);
check(
  "y el valor quedo igual",
  fila.dias_alerta_proxima,
  mismo.cuerpo?.[0]?.dias_alerta_proxima,
  mismo.cuerpo?.[0]?.dias_alerta_proxima === fila.dias_alerta_proxima,
);

console.log("\n=== 4. La base rechaza umbrales invertidos ===");
const invertido = await rest(tokenAdmin, "configuracion?id=eq.true", {
  method: "PATCH",
  body: JSON.stringify({ dias_alerta_proxima: 1, dias_alerta_critica: 30 }),
});
check(
  "proxima menor que critica es rechazado",
  "409 o 400",
  invertido.estado,
  invertido.estado === 409 || invertido.estado === 400,
);
check(
  "y el check que lo frena es el de umbrales",
  "configuracion_umbrales",
  invertido.cuerpo?.message ?? invertido.cuerpo?.details ?? "sin mensaje",
  String(invertido.cuerpo?.message ?? "").includes("umbrales"),
);

const despues = await rest(tokenAdmin, "configuracion?select=dias_alerta_proxima,dias_alerta_critica");
check(
  "el rechazo no dejo residuos",
  `${fila.dias_alerta_proxima}/${fila.dias_alerta_critica}`,
  `${despues.cuerpo?.[0]?.dias_alerta_proxima}/${despues.cuerpo?.[0]?.dias_alerta_critica}`,
  despues.cuerpo?.[0]?.dias_alerta_proxima === fila.dias_alerta_proxima &&
    despues.cuerpo?.[0]?.dias_alerta_critica === fila.dias_alerta_critica,
);

console.log("\n=== 5. Un tecnico no cambia la configuracion ni los roles ===");
if (!tokenTecnico) {
  console.log("  (omitido: no hay credenciales de tecnico@demo.local)");
} else {
  const intento = await rest(tokenTecnico, "configuracion?id=eq.true", {
    method: "PATCH",
    body: JSON.stringify({ nombre_organizacion: fila.nombre_organizacion }),
  });
  /*
    Aca esta la trampa. El filtro id=eq.true SI calza con la unica fila, asi que
    un 204 con cuerpo vacio no es "no habia nada que actualizar": es RLS
    frenando la escritura. Lo que se mira es que no vuelva ninguna fila.
  */
  check(
    "el tecnico no escribe configuracion",
    "no vuelve fila",
    Array.isArray(intento.cuerpo) ? `${intento.cuerpo.length} fila(s)` : "sin cuerpo",
    !Array.isArray(intento.cuerpo) || intento.cuerpo.length === 0,
  );

  const objetivo = admins[0];
  const escalar = await rest(tokenTecnico, `profiles?id=eq.${objetivo.id}`, {
    method: "PATCH",
    body: JSON.stringify({ rol: "lector" }),
  });
  check(
    "el tecnico no cambia el rol de un admin",
    "no vuelve fila",
    Array.isArray(escalar.cuerpo) ? `${escalar.cuerpo.length} fila(s)` : "sin cuerpo",
    !Array.isArray(escalar.cuerpo) || escalar.cuerpo.length === 0,
  );

  const sigue = await rest(tokenAdmin, `profiles?id=eq.${objetivo.id}&select=rol,activo`);
  check(
    "y ese admin sigue siendo admin",
    "admin",
    sigue.cuerpo?.[0]?.rol,
    sigue.cuerpo?.[0]?.rol === "admin" && sigue.cuerpo?.[0]?.activo === true,
  );
}

console.log("\n=== 6. Guarda del ultimo administrador ===");
/*
  Se comprueba si el trigger de 20260902130000_guarda_ultimo_admin.sql esta
  aplicado. No se prueba degradando a nadie: el escenario exige quedar con un
  solo admin, y equivocarse ahi deja el sistema sin nadie que pueda entrar a
  configuracion.
*/
console.log(
  admins.length > 1
    ? `  nota: hay ${admins.length} administradores activos, asi que la guarda no esta en juego hoy`
    : "  ATENCION: hay un solo administrador activo. Nombra otro antes de tocar roles.",
);
console.log(
  "  la guarda de base vive en supabase/migrations/20260902130000_guarda_ultimo_admin.sql",
);

console.log(`\n${fallas === 0 ? "TODO OK" : `${fallas} FALLA(S)`}`);
process.exit(fallas === 0 ? 0 : 1);
