"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISOS, requiereRol } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoAccion = { error?: string; ok?: string };

const TIPOS = ["preventiva", "correctiva", "predictiva"] as const;
const ESTADOS = ["programada", "en_ejecucion", "completada", "anulada"] as const;

/* Tipos MIME que acepta el bucket documentos. Se valida antes de subir para
   dar un mensaje util en vez del error crudo de Storage. */
const MIME_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];
const TAMANO_MAXIMO = 20 * 1024 * 1024;

const texto = (d: FormData, c: string) => String(d.get(c) ?? "").trim();
const opcional = (d: FormData, c: string) => (texto(d, c).length > 0 ? texto(d, c) : null);
const numero = (d: FormData, c: string) => {
  const v = texto(d, c);
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function traduceError(codigo: string | undefined, mensaje: string): string {
  if (codigo === "42501") return "Tu rol no tiene permiso para esta operación.";
  if (codigo === "23503") return "Alguna referencia no existe: revisa el activo, el plan o el proveedor.";
  if (codigo === "23514") {
    /*
      Cada check constraint se traduce por separado. El mensaje generico
      mandaba a "revisar fechas y montos" cuando el problema real era la causa
      de la falla en una orden preventiva, y como el tipo viene por defecto en
      preventiva, era un callejon sin salida: el usuario corregia fechas y
      montos una y otra vez sin encontrar nada.
    */
    if (mensaje.includes("causa_falla")) {
      return "La causa de la falla solo se registra en mantenciones correctivas. Cambia el tipo a Correctiva o deja ese campo vacío.";
    }
    if (mensaje.includes("fecha_ejecucion")) {
      return "Una orden completada necesita fecha de ejecución.";
    }
    return "Los datos no cumplen una regla de la base. Revisa fechas y montos.";
  }
  console.error("Error de base:", mensaje);
  return "No pude guardar. Revisa los datos e intenta de nuevo.";
}

/*
  Alta de orden.

  No se reciben monto_repuestos ni costo_total del formulario, y no es un olvido:
  monto_repuestos lo mantiene un trigger a partir de las lineas, y costo_total es
  una columna generada. Aceptarlos aca permitiria que la interfaz contradiga a la
  base, que es justo lo que el modelo evita.

  Una orden nace sin lineas: las lineas necesitan orden_id, asi que el flujo es
  crear la orden y despues cargarle repuestos y factura en su ficha. Es el orden
  que impone el modelo y tambien el orden real del trabajo.
*/
export async function crearOrden(_prev: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    await requiereRol(PERMISOS.operar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const activo_id = texto(datos, "activo_id");
  const tipo = texto(datos, "tipo");
  const estado = texto(datos, "estado");
  const fecha_ejecucion = opcional(datos, "fecha_ejecucion");

  if (!activo_id) return { error: "Elige el activo." };
  if (!TIPOS.includes(tipo as (typeof TIPOS)[number])) return { error: "Tipo no válido." };
  if (!ESTADOS.includes(estado as (typeof ESTADOS)[number])) return { error: "Estado no válido." };

  // La base tiene un constraint que exige fecha_ejecucion cuando la orden esta
  // completada. Se valida aca tambien para explicar por que, en vez de mostrar
  // el nombre del constraint.
  if (estado === "completada" && !fecha_ejecucion) {
    return { error: "Una orden completada necesita fecha de ejecución." };
  }

  const supabase = await crearClienteServidor();
  const plan_id = opcional(datos, "plan_id");

  /*
    La base no impone que el plan pertenezca al activo de la orden, y una orden
    con un plan de otra maquina rompe el calculo del semaforo en silencio: la
    vista tomaria esa ejecucion como linea base del plan equivocado. Se valida
    aca, que es donde se puede explicar.
  */
  if (plan_id) {
    const { data: plan } = await supabase
      .from("planes_mantencion")
      .select("activo_id")
      .eq("id", plan_id)
      .maybeSingle();

    if (!plan || plan.activo_id !== activo_id) {
      return { error: "Ese plan pertenece a otro activo. Elige un plan del activo seleccionado." };
    }
  }

  const { data, error } = await supabase
    .from("ordenes_mantencion")
    .insert({
      activo_id,
      plan_id,
      tipo,
      estado,
      fecha_programada: opcional(datos, "fecha_programada"),
      fecha_ejecucion,
      horometro_ejecucion: numero(datos, "horometro_ejecucion"),
      kilometraje_ejecucion: numero(datos, "kilometraje_ejecucion"),
      descripcion_trabajo: texto(datos, "descripcion_trabajo"),
      causa_falla: opcional(datos, "causa_falla"),
      proveedor_id: opcional(datos, "proveedor_id"),
      ejecutor_interno: opcional(datos, "ejecutor_interno"),
      numero_factura: opcional(datos, "numero_factura"),
      fecha_factura: opcional(datos, "fecha_factura"),
      monto_mano_obra: numero(datos, "monto_mano_obra") ?? 0,
      monto_otros: numero(datos, "monto_otros") ?? 0,
      tiempo_fuera_servicio_horas: numero(datos, "tiempo_fuera_servicio_horas"),
    })
    .select("id")
    .single();

  if (error) return { error: traduceError(error.code, error.message) };

  revalidatePath("/admin/mantenciones");
  revalidatePath("/admin");
  redirect(`/admin/mantenciones/${data.id}`);
}

export async function actualizarOrden(_prev: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    await requiereRol(PERMISOS.operar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const id = texto(datos, "id");
  const estado = texto(datos, "estado");
  const fecha_ejecucion = opcional(datos, "fecha_ejecucion");
  if (!id) return { error: "Falta el identificador de la orden." };
  if (estado === "completada" && !fecha_ejecucion) {
    return { error: "Una orden completada necesita fecha de ejecución." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("ordenes_mantencion")
    .update({
      estado,
      fecha_programada: opcional(datos, "fecha_programada"),
      fecha_ejecucion,
      horometro_ejecucion: numero(datos, "horometro_ejecucion"),
      kilometraje_ejecucion: numero(datos, "kilometraje_ejecucion"),
      descripcion_trabajo: texto(datos, "descripcion_trabajo"),
      causa_falla: opcional(datos, "causa_falla"),
      proveedor_id: opcional(datos, "proveedor_id"),
      ejecutor_interno: opcional(datos, "ejecutor_interno"),
      numero_factura: opcional(datos, "numero_factura"),
      fecha_factura: opcional(datos, "fecha_factura"),
      monto_mano_obra: numero(datos, "monto_mano_obra") ?? 0,
      monto_otros: numero(datos, "monto_otros") ?? 0,
      tiempo_fuera_servicio_horas: numero(datos, "tiempo_fuera_servicio_horas"),
    })
    .eq("id", id);

  if (error) return { error: traduceError(error.code, error.message) };

  revalidatePath(`/admin/mantenciones/${id}`);
  revalidatePath("/admin/mantenciones");
  revalidatePath("/admin");
  return { ok: "Cambios guardados." };
}

/*
  Alta de linea de repuesto.

  Al insertar, un trigger recalcula monto_repuestos de la orden y genera el
  movimiento de stock que descuenta del inventario. Por eso no se toca stock
  desde aca: hacerlo duplicaria el descuento.
*/
export async function agregarLinea(_prev: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    await requiereRol(PERMISOS.operar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const orden_id = texto(datos, "orden_id");
  const repuesto_id = opcional(datos, "repuesto_id");
  const descripcion_libre = opcional(datos, "descripcion_libre");
  const cantidad = numero(datos, "cantidad");
  const costo_unitario = numero(datos, "costo_unitario") ?? 0;

  if (!orden_id) return { error: "Falta la orden." };
  // La base tiene un constraint que exige uno de los dos. Se explica aca.
  if (!repuesto_id && !descripcion_libre) {
    return { error: "Elige un repuesto del maestro o escribe una descripción libre." };
  }
  if (cantidad === null || cantidad <= 0) return { error: "La cantidad tiene que ser mayor que cero." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("orden_repuestos")
    .insert({ orden_id, repuesto_id, descripcion_libre, cantidad, costo_unitario });

  if (error) return { error: traduceError(error.code, error.message) };

  revalidatePath(`/admin/mantenciones/${orden_id}`);
  revalidatePath("/admin");
  /*
    El mensaje distingue los dos casos porque el trigger tambien los distingue:
    una linea con descripcion libre no tiene repuesto_id, asi que no mueve
    inventario. Prometer un descuento que no ocurrio manda a alguien a buscar un
    movimiento que no existe.
  */
  return {
    ok: repuesto_id
      ? "Repuesto agregado. El stock ya quedó descontado."
      : "Línea agregada. Al ser un repuesto fuera del maestro, no mueve inventario.",
  };
}

/*
  Borrado de linea. La politica orden_repuestos_delete_admin exige es_admin(),
  asi que un tecnico no puede corregir una linea mal digitada borrandola. Es una
  decision de la especificacion original y sigue abierta a revision: la
  alternativa seria permitirle borrar lineas de ordenes no completadas.
*/
export async function eliminarLinea(_prev: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch {
    return { error: "Solo un administrador puede eliminar una línea de repuesto." };
  }

  const id = texto(datos, "id");
  const orden_id = texto(datos, "orden_id");
  if (!id) return { error: "Falta la línea." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("orden_repuestos").delete().eq("id", id);
  if (error) return { error: traduceError(error.code, error.message) };

  revalidatePath(`/admin/mantenciones/${orden_id}`);
  revalidatePath("/admin");
  return { ok: "Línea eliminada. El trigger revirtió el movimiento de stock." };
}

/*
  Adjunto de factura al bucket privado documentos.

  Se sube con la sesion de quien opera, no con service_role, y eso es
  deliberado: las politicas de storage.objects ya permiten INSERT a
  authenticated con puede_operar() y SELECT con puede_leer(), asi que la
  aplicacion nunca necesita una clave que se salte RLS. Verificado contra el
  proyecto real: subida 200, firma de URL 200, y la misma ruta responde 400 por
  URL publica y 400 con solo la anon key.
*/
export async function subirFactura(_prev: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    await requiereRol(PERMISOS.operar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const orden_id = texto(datos, "orden_id");
  const archivo = datos.get("archivo");
  const tipo_documento = texto(datos, "tipo_documento") || "factura";

  if (!orden_id) return { error: "Falta la orden." };
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige un archivo." };
  if (archivo.size > TAMANO_MAXIMO) return { error: "El archivo supera los 20 MB." };
  if (!MIME_PERMITIDOS.includes(archivo.type)) {
    return { error: `El bucket no acepta ${archivo.type || "ese tipo de archivo"}. Usa PDF, imagen o planilla.` };
  }

  const supabase = await crearClienteServidor();

  /*
    La ruta lleva la orden y un sufijo aleatorio. El sufijo evita que dos
    facturas con el mismo nombre se sobreescriban entre si, que en un galpon
    pasa seguido: todas se llaman factura.pdf.
  */
  const extension = archivo.name.includes(".") ? archivo.name.split(".").pop() : "bin";
  const ruta = `ordenes/${orden_id}/${crypto.randomUUID()}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from("documentos")
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

  if (errorSubida) {
    console.error("No pude subir el adjunto:", errorSubida.message);
    return { error: "No pude subir el archivo. Revisa el formato y el tamaño." };
  }

  const { error } = await supabase.from("documentos").insert({
    entidad_tipo: "orden",
    entidad_id: orden_id,
    tipo_documento,
    nombre_archivo: archivo.name,
    storage_path: ruta,
    bucket: "documentos",
    mime_type: archivo.type,
    tamano_bytes: archivo.size,
  });

  if (error) {
    // Si la fila no se pudo registrar, se borra el archivo: un objeto en Storage
    // sin fila en documentos es basura que nadie va a encontrar nunca.
    await supabase.storage.from("documentos").remove([ruta]);
    return { error: traduceError(error.code, error.message) };
  }

  revalidatePath(`/admin/mantenciones/${orden_id}`);
  return { ok: "Documento adjuntado." };
}

/*
  URL firmada para ver un adjunto. Vive en el servidor y expira en 60 segundos:
  una factura no se sirve nunca por URL publica, y una URL firmada de larga vida
  es una URL publica con pasos extra.
*/
export async function urlFirmada(storagePath: string): Promise<string | null> {
  try {
    await requiereRol(PERMISOS.leer);
  } catch {
    return null;
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(storagePath, 60);

  if (error) {
    console.error("No pude firmar la URL:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/*
  Editar una linea de repuesto ya cargada.

  Se puede hacer con seguridad porque los triggers cubren el UPDATE, no solo el
  INSERT y el DELETE:
  - orden_repuestos_consumo dispara con UPDATE OF repuesto_id, cantidad, asi que
    cambiar la cantidad ajusta el stock por la diferencia. La aplicacion no
    calcula nada de eso.
  - orden_repuestos_recalcula_monto dispara con cualquier UPDATE, asi que
    monto_repuestos de la orden queda al dia, y con el costo_total, que es
    columna generada.

  Antes la unica via era eliminar la linea y volver a cargarla, y eso dejaba dos
  movimientos extra en el libro de stock por cada correccion de un digito.
*/
export async function actualizarLinea(_prev: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    await requiereRol(PERMISOS.operar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const id = texto(datos, "id");
  const orden_id = texto(datos, "orden_id");
  const cantidad = numero(datos, "cantidad");
  const costo_unitario = numero(datos, "costo_unitario");

  if (!id) return { error: "Falta la línea." };
  if (cantidad === null || cantidad <= 0) {
    return { error: "La cantidad tiene que ser mayor que cero." };
  }
  if (costo_unitario === null || costo_unitario < 0) {
    return { error: "El costo unitario no puede ser negativo." };
  }

  const supabase = await crearClienteServidor();
  /*
    Se filtra tambien por orden_id: sin eso, un id de linea de otra orden puesto
    a mano editaria la linea ajena. RLS comprueba el rol, no la pertenencia.
  */
  const { data, error } = await supabase
    .from("orden_repuestos")
    .update({ cantidad, costo_unitario })
    .eq("id", id)
    .eq("orden_id", orden_id)
    .select("id");

  if (error) return { error: traduceError(error.code, error.message) };
  if (!data || data.length === 0) {
    return { error: "Esa línea ya no existe o no pertenece a esta orden." };
  }

  revalidatePath(`/admin/mantenciones/${orden_id}`);
  revalidatePath("/admin/repuestos");
  revalidatePath("/admin");
  return { ok: "Línea actualizada. La base ajustó el stock y recalculó el costo." };
}

/*
  Borrar un documento adjunto.

  Se borran las DOS cosas y en este orden: primero la fila, despues el objeto en
  Storage. Si fuera al revés y la fila fallara, quedaria una fila apuntando a un
  archivo que no existe, y la interfaz ofreceria descargar algo roto. En cambio
  un objeto que sobrevive a su fila es basura silenciosa que no rompe nada, y si
  el borrado en Storage falla se registra para poder limpiarlo despues.

  Rol administrar, igual que la politica documentos_delete_admin de la base.
*/
export async function eliminarDocumento(_prev: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch {
    return { error: "Solo un administrador puede borrar un documento adjunto." };
  }

  const id = texto(datos, "id");
  const orden_id = texto(datos, "orden_id");
  if (!id) return { error: "Falta el documento." };

  const supabase = await crearClienteServidor();

  const { data, error } = await supabase
    .from("documentos")
    .delete()
    .eq("id", id)
    .eq("entidad_id", orden_id)
    .select("storage_path, bucket, nombre_archivo");

  if (error) return { error: traduceError(error.code, error.message) };
  if (!data || data.length === 0) {
    return { error: "Ese documento ya no existe o no pertenece a esta orden." };
  }

  const doc = data[0] as { storage_path: string; bucket: string; nombre_archivo: string };
  const { error: errorStorage } = await supabase.storage
    .from(doc.bucket ?? "documentos")
    .remove([doc.storage_path]);

  if (errorStorage) {
    /*
      La fila ya no esta, asi que para el usuario el documento desaparecio. Lo
      que queda es un objeto huerfano en el bucket, y eso se dice en vez de
      fingir que todo salio bien.
    */
    console.error("Borré la fila del documento pero no el archivo:", errorStorage.message);
    revalidatePath(`/admin/mantenciones/${orden_id}`);
    return {
      ok: `Documento "${doc.nombre_archivo}" quitado de la orden. El archivo quedó en el almacenamiento y hay que borrarlo aparte.`,
    };
  }

  revalidatePath(`/admin/mantenciones/${orden_id}`);
  return { ok: `Documento "${doc.nombre_archivo}" borrado.` };
}

/*
  Borrar una orden de mantencion completa.

  EL ORDEN DE LAS SENTENCIAS NO ES ESTILO, ES LO QUE HACE QUE FUNCIONE.

  El intento evidente, un DELETE sobre la orden y dejar que la cascada haga el
  resto, FALLA SIEMPRE en cuanto la orden tiene una linea del maestro. Probado
  contra la base con rollback: error 23503 sobre
  movimientos_stock_orden_id_fkey. La razon es que la cascada borra las lineas
  dentro de la misma sentencia, el trigger tg_consumo_desde_linea inserta el
  movimiento de reversa con orden_id apuntando a la orden que se esta borrando,
  y esa llave foranea no es deferrable: al cerrar la sentencia el movimiento
  apunta a una fila que ya no existe.

  La solucion no necesita tocar el esquema, solo separar las sentencias:
   1. Los documentos, porque NADA los arrastra. documentos.entidad_id no tiene
      llave foranea, asi que sin este paso quedan filas huerfanas apuntando a
      una orden inexistente, mas sus archivos en el bucket privado.
   2. Las lineas, en su propia sentencia. La reversa se inserta mientras la
      orden todavia existe, asi que la llave foranea se cumple.
   3. La orden. Los movimientos que quedaron apuntandola pasan a orden_id nulo
      por ON DELETE SET NULL, y el libro se conserva entero.

  Verificado con rollback contra la base real: el stock vuelve a su valor
  original y el libro conserva los consumos Y sus reversas.

  LA ALTERNATIVA QUE LA PANTALLA OFRECE PRIMERO ES ANULAR, y para casi todos los
  casos es la correcta: el trigger ordenes_anula_revierte_stock devuelve el
  stock con movimientos de ajuste y la orden queda en el historial. Borrar es
  para la orden que nunca debio existir, no para el trabajo que salio mal.

  Se pide escribir el folio. En un listado de doscientas ordenes es lo unico
  corto y unico que identifica a cada una.
*/
export async function eliminarOrden(_prev: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    await requiereRol(PERMISOS.administrar);
  } catch {
    return { error: "Solo un administrador puede borrar una orden de mantención." };
  }

  const id = texto(datos, "id");
  const confirmacion = texto(datos, "confirmacion");
  const folioEsperado = texto(datos, "folio_esperado");

  if (!id) return { error: "Falta la orden." };
  if (confirmacion !== folioEsperado) {
    return { error: `Para borrar, escribe exactamente el folio: ${folioEsperado}` };
  }

  const supabase = await crearClienteServidor();

  /* Paso 1: los adjuntos. Nada los arrastra, asi que se van a mano. */
  const { data: docs, error: errorDocs } = await supabase
    .from("documentos")
    .delete()
    .eq("entidad_tipo", "orden")
    .eq("entidad_id", id)
    .select("storage_path, bucket");

  if (errorDocs) return { error: traduceError(errorDocs.code, errorDocs.message) };

  let archivosHuerfanos = 0;
  if (docs && docs.length > 0) {
    const porBucket = new Map<string, string[]>();
    for (const d of docs as { storage_path: string; bucket: string | null }[]) {
      const bucket = d.bucket ?? "documentos";
      porBucket.set(bucket, [...(porBucket.get(bucket) ?? []), d.storage_path]);
    }
    for (const [bucket, rutas] of porBucket) {
      const { error } = await supabase.storage.from(bucket).remove(rutas);
      if (error) {
        console.error(`No pude borrar ${rutas.length} archivo(s) de ${bucket}:`, error.message);
        archivosHuerfanos += rutas.length;
      }
    }
  }

  /* Paso 2: las lineas, en su propia sentencia. */
  const { error: errorLineas } = await supabase
    .from("orden_repuestos")
    .delete()
    .eq("orden_id", id);

  if (errorLineas) {
    return {
      error:
        errorLineas.code === "42501"
          ? "Tu rol no tiene permiso para quitar las líneas de repuesto de esta orden."
          : traduceError(errorLineas.code, errorLineas.message),
    };
  }

  /* Paso 3: la orden. */
  const { data, error } = await supabase
    .from("ordenes_mantencion")
    .delete()
    .eq("id", id)
    .select("folio");

  if (error) return { error: traduceError(error.code, error.message) };
  if (!data || data.length === 0) {
    /*
      Las lineas y los documentos ya se fueron. Decirlo importa: sin este aviso
      la orden aparece vacia y nadie sabe por que.
    */
    return {
      error:
        "Esa orden ya no existe, pero sus líneas y adjuntos sí se borraron. Revisa la orden antes de seguir.",
    };
  }

  revalidatePath("/admin/mantenciones");
  revalidatePath("/admin/repuestos");
  revalidatePath("/admin/reportes");
  revalidatePath("/admin/activos");
  revalidatePath("/admin");

  if (archivosHuerfanos > 0) {
    /*
      No se redirige en este caso: hay algo que la persona tiene que leer. Un
      redirect se llevaria el mensaje.
    */
    return {
      ok: `Orden ${data[0].folio} borrada y el stock devuelto. Quedaron ${archivosHuerfanos} archivo(s) en el almacenamiento que hay que borrar aparte.`,
    };
  }

  redirect("/admin/mantenciones");
}
