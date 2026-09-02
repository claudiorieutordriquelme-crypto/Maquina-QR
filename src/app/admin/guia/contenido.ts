/*
  Contenido de la guia de uso.

  Va como datos y no como JSX por dos razones: el render queda uniforme para las
  nueve secciones, y actualizar un paso es editar una linea en vez de navegar
  ochocientas lineas de marcado.

  COMO SE ESCRIBIO ESTO. No de memoria. Se levantaron dieciocho agentes: uno por
  seccion leyendo el codigo fuente y describiendo lo que la pantalla hace de
  verdad, y un escéptico por seccion tratando de refutar esa descripcion contra
  el mismo codigo. Las nueve volvieron con correcciones, y varias eran bugs
  reales que se arreglaron antes de escribir esta guia. Una guia que promete
  algo que el codigo no hace es peor que no tener guia.

  REGLA PARA MANTENERLA. Si cambia una pantalla, cambia este archivo en el mismo
  commit. Lo que mas rapido envejece de una guia son los "todavia no hace":
  aparecen como definitivos y vencen en el siguiente despliegue.
*/

export type Paso = {
  titulo: string;
  /** Lo que aparece en pantalla, con los textos literales de los botones. */
  ves: string;
  /** Lo que ocurre por detras, en lenguaje de negocio. */
  pasa: string;
};

export type Seccion = {
  id: string;
  nombre: string;
  ruta: string;
  sirve: string;
  pasos: Paso[];
  quien: string;
  ojo: string[];
  falta: string[];
};

export const SECCIONES_GUIA: Seccion[] = [
  {
    id: "entrar",
    nombre: "Entrar al panel",
    ruta: "/login",
    sirve:
      "Es la puerta al panel privado. La ficha que se abre al escanear un código QR no necesita cuenta: esta pantalla es solo para administrar.",
    pasos: [
      {
        titulo: "Abrir la pantalla de acceso",
        ves: "El logo, el rótulo “Mantención de maquinaria” y dos campos: Correo y Contraseña. El cursor ya está en Correo.",
        pasa: "Si venías redirigido desde una pantalla del panel, el sistema recuerda a dónde ibas para devolverte ahí después de entrar.",
      },
      {
        titulo: "Entrar con la cuenta de prueba, sin tipear",
        ves: "Bajo el formulario, el recuadro “Acceso de demostración” con el correo y la contraseña a la vista, y el botón “Ingresar como DEMO”.",
        pasa: "Entra con esa cuenta usando la clave que el sistema tiene guardada, sin leer nada de lo que esté escrito en la pantalla. Es la vía rápida para probar desde el celular.",
      },
      {
        titulo: "O escribir tu correo y tu contraseña",
        ves: "El botón “Entrar”. Mientras revisa dice “Entrando...” y queda desactivado para que no lo aprietes dos veces.",
        pasa: "Si la clave está mal, vuelve el aviso “Correo o contraseña incorrectos” y el correo queda escrito: solo hay que corregir la contraseña.",
      },
      {
        titulo: "Quedar dentro",
        ves: "El panel, con tu nombre y tu rol arriba a la izquierda.",
        pasa: "Si vuelves a escribir la dirección del login estando dentro, te devuelve al panel de inmediato.",
      },
    ],
    quien:
      "La pantalla es abierta y cualquiera puede probar con la cuenta de demostración. Lo que puedas hacer después depende de tu rol, y de que tu perfil esté habilitado.",
    ojo: [
      "El mensaje de error es siempre el mismo, aunque el problema real sea que la cuenta no existe. Es deliberado: así nadie puede ir probando correos para descubrir cuáles tienen cuenta. La contra es que si te quedas afuera, la pantalla no te dice el motivo.",
      "Si entras bien pero aparece “Sin acceso al panel”, no es una falla: tu cuenta no tiene perfil habilitado, o el sistema no pudo leerlo. Si estás seguro de tener perfil, el problema es de lectura y hay que revisar el servidor, no pedir un perfil nuevo.",
      "La cuenta de demostración es compartida y tiene permisos completos. Cualquiera con el link puede crear, editar y borrar. No cargues ahí información real de la operación.",
    ],
    falta: [
      "No hay “olvidé mi contraseña”, ni cambio de clave, ni recuperación por correo.",
      "No hay registro: las cuentas las carga un administrador por base de datos.",
      "No hay entrada con Google o Microsoft, ni segundo factor.",
    ],
  },
  {
    id: "resumen",
    nombre: "Resumen",
    ruta: "/admin",
    sirve:
      "Muestra en un vistazo cuántos planes de mantención de la flota están vencidos, críticos, próximos o al día, más tres números de contexto.",
    pasos: [
      {
        titulo: "Leer el semáforo de la flota",
        ves: "Cuatro tarjetas con un número grande, una franja de color al costado y un glifo distinto por estado: Vencida, Crítica, Próxima y Al día.",
        pasa: "Cada tarjeta cuenta planes, no máquinas. Una misma máquina con tres planes puede aparecer en tres tarjetas distintas.",
      },
      {
        titulo: "Revisar los tres indicadores de contexto",
        ves: "Planes vigentes, Activos fuera de servicio y Repuestos bajo stock mínimo.",
        pasa: "“Planes vigentes” es el total de planes que el sistema está calculando, y puede ser mayor que la suma de las cuatro tarjetas.",
      },
      {
        titulo: "Fijarse en el aviso de planes sin datos",
        ves: "Una línea en letra chica bajo los indicadores, solo cuando corresponde.",
        pasa: "Son planes a los que les falta fecha de adquisición, ejecución previa o lecturas de horómetro. Sin eso el sistema no tiene desde dónde contar.",
      },
      {
        titulo: "Confirmar qué puedes hacer",
        ves: "El bloque “Tu acceso” con tu rol y lo que ese rol permite.",
        pasa: "Es la referencia rápida cuando un botón no aparece: casi siempre es el rol, no una falla.",
      },
    ],
    quien:
      "Los tres roles ven esta pantalla. Los números son lo que tu sesión puede leer, no necesariamente la flota completa.",
    ojo: [
      "Los números no se pueden pinchar: no llevan a la lista de máquinas afectadas. Para eso hay que ir a Activos y filtrar por semáforo.",
      "Si una de las tres consultas falla, desaparece todo el bloque de números y sale un aviso, aunque las otras dos hayan devuelto datos correctos.",
      "Vencida y Crítica comparten el color. Se distinguen por el glifo y por la palabra, y eso es a propósito: en terreno el color es lo primero que se pierde con sol directo o con daltonismo.",
    ],
    falta: [
      "La tabla ordenada por criticidad, con acceso directo a registrar la mantención de cada plan.",
      "Los gráficos de costo por activo y el split entre preventiva y correctiva.",
      "La exportación a CSV.",
    ],
  },
  {
    id: "activos",
    nombre: "Activos",
    ruta: "/admin/activos",
    sirve:
      "Es el inventario de la maquinaria. Muestra toda la flota con el estado de mantención de cada máquina a la vista, y permite cargar, editar y borrar.",
    pasos: [
      {
        titulo: "Abrir el listado y filtrar",
        ves: "Cuatro desplegables: Tipo, Estado, Ubicación y Semáforo, más el botón “Filtrar”. “Limpiar” aparece recién cuando hay filtros puestos.",
        pasa: "El filtro queda en la dirección del navegador, así que puedes guardar el link de “todo lo vencido en el fundo El Roble” y volver con el botón atrás.",
      },
      {
        titulo: "Leer el semáforo de cada máquina",
        ves: "Cada máquina es una tarjeta con franja de color, insignia de estado, y abajo Estado y Planes siempre, más Ubicación y Horómetro si están cargados.",
        pasa: "El semáforo de la máquina es el peor de sus planes: si uno está vencido, la máquina está vencida, aunque los otros dos estén al día.",
      },
      {
        titulo: "Entrar a la ficha de una máquina",
        ves: "Al pie de cada tarjeta: “Ver y editar”, “Etiqueta QR” y “Ver ficha pública”.",
        pasa: "La ficha muestra los planes con su plazo, las últimas lecturas de horómetro y el formulario de edición.",
      },
      {
        titulo: "Cargar una máquina nueva",
        ves: "El botón “Nuevo activo”, y luego cuatro bloques de campos. Los que llevan asterisco son obligatorios: Nombre, Código interno, Tipo y Estado.",
        pasa: "El código QR se genera solo, con un token aleatorio que crea la base de datos. Al guardar te deja directo en la etiqueta, lista para imprimir.",
      },
      {
        titulo: "Editar o borrar",
        ves: "En la ficha, el formulario de edición y más abajo la zona de borrado, que pide escribir el código interno para confirmar.",
        pasa: "Editar no cambia el código QR, así que las etiquetas ya pegadas siguen funcionando. Borrar se lleva los planes y las lecturas de esa máquina.",
      },
    ],
    quien:
      "Los tres roles ven el listado, las fichas y la impresión de etiquetas. Crear, editar y borrar es solo de Administrador.",
    ojo: [
      "Una máquina con mantenciones registradas no se puede borrar: la base lo impide para no perder el historial. En ese caso el botón de borrar no aparece y lo correcto es cambiarla al estado “dado de baja”.",
      "Al pasar una máquina a “dado de baja”, su ficha pública deja de responder y sale de la impresión de etiquetas. El código QR pegado en la máquina queda muerto.",
      "El código interno y la patente se pasan solos a mayúsculas, y a la patente se le quitan los guiones. Si escribes “tr-002” queda “TR-002”.",
      "Sin horómetro cargado, los planes por horas de uso detectan el vencimiento pero no pueden anticiparlo en días.",
    ],
    falta: [
      "Los planes de mantención, que son los que alimentan el semáforo, todavía no se crean desde el panel: se cargan por base de datos. Mientras eso no cambie, una máquina nueva va a mostrar “Sin planes”.",
      "Los tipos de activo vienen precargados y no se pueden agregar desde la aplicación.",
      "No se pueden registrar lecturas de horómetro a mano: se actualiza al completar una mantención con horómetro.",
    ],
  },
  {
    id: "etiquetas",
    nombre: "Etiquetas QR",
    ruta: "/admin/activos/etiquetas",
    sirve:
      "Saca en papel los códigos que se pegan en las máquinas. Cada etiqueta lleva el código de flota, el nombre y un QR que abre la ficha de mantención al escanearlo.",
    pasos: [
      {
        titulo: "Revisar a qué dirección apunta el código",
        ves: "Un recuadro antes de los botones, con la dirección completa y de dónde salió.",
        pasa: "Es el único control real antes de imprimir. Si el dominio cambia después, cada etiqueta pegada queda apuntando a una dirección muerta y hay que reimprimir una por una.",
      },
      {
        titulo: "Elegir qué imprimir y cuántas copias",
        ves: "Una casilla por máquina, un campo de copias de 1 a 20, los atajos “Seleccionar todos” y “Ninguno”, y el contador “X de Y seleccionados · N etiquetas en total”.",
        pasa: "La selección viaja en la dirección del navegador, así que el link de una tanda se puede guardar y repetir tal cual.",
      },
      {
        titulo: "Actualizar la vista previa",
        ves: "El botón “Actualizar la vista previa”.",
        pasa: "Este paso es obligatorio. Marcar casillas no cambia nada hasta apretarlo: si aprietas directo Imprimir, sale la tanda anterior. Es la forma más fácil de perder una hoja de etiquetas.",
      },
      {
        titulo: "Mandar a imprimir",
        ves: "El botón azul con el total, por ejemplo “Imprimir 6 etiquetas”.",
        pasa: "El número cuenta etiquetas, no máquinas: tres máquinas a dos copias dicen seis. La vista previa es exactamente lo que sale de la impresora.",
      },
    ],
    quien: "Los tres roles pueden imprimir etiquetas.",
    ojo: [
      "Cada etiqueta mide 70 por 50 milímetros. Conviene papel adhesivo y, si la máquina trabaja a la intemperie, cinta transparente encima: el código tolera hasta un 25% de daño, pero no el barro que lo tape del todo.",
      "El QR no lleva la patente ni el número interno de la base: lleva un código aleatorio. Una etiqueta fotografiada no revela el inventario, pero sí da acceso a la ficha de esa máquina.",
      "Una etiqueta perdida no se puede anular: no hay forma de regenerar el código desde el panel.",
      "Desde la ficha de una máquina dada de baja se puede imprimir su etiqueta, y la pantalla lo advierte: ese código lleva a “no encontrado”.",
    ],
    falta: [
      "No hay filtro por tipo, ubicación o estado dentro de la pantalla de impresión.",
      "No hay descarga del QR como imagen o PDF: la salida es la impresora del navegador.",
    ],
  },
  {
    id: "mantenciones",
    nombre: "Mantenciones",
    ruta: "/admin/mantenciones",
    sirve:
      "Es el libro de vida de la flota. Registra cada intervención con su fecha, quién la hizo, qué repuestos se usaron y cuánto costó.",
    pasos: [
      {
        titulo: "Revisar el listado y filtrar",
        ves: "Filtros por Tipo, Estado, Proveedor y rango de fechas, y el total en pesos de lo que se está mostrando.",
        pasa: "El listado trae las 200 órdenes con ejecución más reciente. Para llegar a las antiguas hay que acotar el rango de fechas: el filtro corre en la base, no sobre lo que ya está en pantalla.",
      },
      {
        titulo: "Crear la orden",
        ves: "El botón “Nueva mantención” y tres bloques: qué y a qué, cuándo, quién y cuánto. El botón final dice “Crear y agregar repuestos”.",
        pasa: "La orden nace sin repuestos: las líneas necesitan una orden a la que pertenecer. Es el orden que impone el modelo y también el orden real del trabajo.",
      },
      {
        titulo: "Cargar los repuestos usados",
        ves: "En la ficha, la tabla de repuestos y el bloque “Agregar repuesto”, con el maestro o una descripción libre.",
        pasa: "Al agregar un repuesto del maestro, el sistema descuenta el stock solo y recalcula el costo de la orden. Con descripción libre no mueve inventario, y el mensaje lo dice.",
      },
      {
        titulo: "Adjuntar la factura",
        ves: "El bloque “Adjuntar documento” con el tipo y el archivo. Acepta PDF, imágenes y planillas, hasta 20 MB.",
        pasa: "Va a un depósito privado. Nunca se sirve por dirección pública: para verlo se firma una dirección que expira en 60 segundos.",
      },
      {
        titulo: "Cerrar la orden",
        ves: "Arriba los cuadros de Mano de obra, Repuestos, Otros y Costo total, con la nota “Calculado por la base”. Al final “Guardar cambios”.",
        pasa: "El costo total y el monto de repuestos no se pueden escribir: los calcula la base a partir de las líneas. Así la pantalla no puede contradecir al sistema.",
      },
    ],
    quien:
      "Los tres roles ven el listado y las fichas. Crear, editar y cargar repuestos es de Administrador y Técnico. Eliminar una línea de repuesto es solo de Administrador.",
    ojo: [
      "La causa de la falla solo se admite en mantenciones correctivas, y el tipo viene por defecto en Preventiva. Si escribes la causa en una preventiva, el guardado se rechaza y el mensaje te dice exactamente eso.",
      "Para que una mantención mueva el semáforo tiene que cumplir cuatro cosas: llevar plan, ser preventiva, quedar Completada y tener fecha de ejecución. Una correctiva no mueve el semáforo nunca.",
      "El horómetro pasa a la máquina recién cuando la orden queda Completada con fecha de ejecución.",
      "La descripción del trabajo, la causa de la falla y el detalle de repuestos se publican en la ficha pública del QR. Los montos, el proveedor y el número de factura no, mientras la bandera de costos esté apagada.",
      "El total en pesos del listado es la suma de lo que se está mostrando, no el gasto histórico de la flota.",
    ],
    falta: [
      "No se puede aislar el historial de una sola máquina desde esta pantalla: para eso está la ficha pública de su QR.",
      "No se puede borrar una orden: lo más cercano es dejarla en estado Anulada.",
      "No se puede corregir una línea de repuesto ya cargada: se elimina y se agrega de nuevo.",
    ],
  },
  {
    id: "repuestos",
    nombre: "Repuestos y libro de stock",
    ruta: "/admin/repuestos",
    sirve:
      "Es el maestro de repuestos con su saldo, y el libro donde queda registrado cada movimiento de inventario.",
    pasos: [
      {
        titulo: "Ver qué falta comprar",
        ves: "Arriba, si corresponde, un recuadro con franja de acento y la lista de repuestos bajo el mínimo, con el saldo y el mínimo de cada uno.",
        pasa: "Es lo único de esta pantalla que exige actuar hoy, y por eso va primero.",
      },
      {
        titulo: "Crear un repuesto",
        ves: "El botón “Nuevo repuesto” con código, nombre, unidad, stock mínimo, costo de referencia y proveedor habitual.",
        pasa: "El stock parte en cero. El saldo se carga con un movimiento de ingreso, no escribiéndolo a mano: así queda respaldado en el libro que se audita.",
      },
      {
        titulo: "Registrar un movimiento",
        ves: "El bloque “Movimiento de stock” con el repuesto, el tipo (Ingreso o Ajuste), la cantidad y el motivo, que es obligatorio.",
        pasa: "El sistema actualiza el saldo solo. Un ajuste puede ser negativo; un ingreso no.",
      },
      {
        titulo: "Leer el libro",
        ves: "La tabla con fecha, repuesto, tipo, cantidad y motivo. Los movimientos que vienen de una orden llevan la marca “(desde una orden)”.",
        pasa: "El libro es de solo agregar. Ni un administrador puede borrar una fila: una corrección se hace con un ajuste que compensa, y queda registrado.",
      },
    ],
    quien:
      "Los tres roles ven la pantalla. Registrar movimientos es de Administrador y Técnico. Crear y editar repuestos es solo de Administrador.",
    ojo: [
      "El consumo no se registra a mano: lo genera la orden de mantención al cargarle repuestos. Registrarlo aquí lo descontaría dos veces.",
      "La columna Cantidad lleva signo. Los consumos se leen en negativo, y un ajuste de resta también.",
      "El saldo puede quedar negativo si un ajuste resta más de lo que hay. No hay tope.",
      "El costo de referencia es solo referencia, no el costo real de la última compra.",
    ],
    falta: [
      "No hay órdenes de compra ni recepción de mercadería.",
      "No hay alerta por correo cuando algo baja del mínimo: hay que entrar a mirar.",
    ],
  },
  {
    id: "proveedores",
    nombre: "Proveedores",
    ruta: "/admin/proveedores",
    sirve: "Es el maestro de quienes hacen mantenciones externas o venden repuestos.",
    pasos: [
      {
        titulo: "Revisar el maestro",
        ves: "Una tarjeta por proveedor con el nombre, el RUT y el giro, y debajo el contacto, el teléfono, el correo y la dirección si están cargados.",
        pasa: "Los inactivos siguen en la lista, marcados como tal, porque tienen órdenes históricas asociadas.",
      },
      {
        titulo: "Crear o editar",
        ves: "El botón “Nuevo proveedor”, o el enlace “Editar” en cada tarjeta. Solo el nombre es obligatorio.",
        pasa: "El RUT lo valida la base con módulo 11 y lo normaliza: se guarda sin puntos y con guion, así que casi nunca se va a ver igual a como lo escribiste.",
      },
      {
        titulo: "Desactivar en vez de borrar",
        ves: "En la edición, el campo Estado con Activo e Inactivo.",
        pasa: "Un proveedor inactivo deja de aparecer en los desplegables de mantenciones y repuestos, pero conserva su historial.",
      },
    ],
    quien: "Los tres roles ven el maestro. Crear y editar es solo de Administrador.",
    ojo: [
      "Nada impide dos proveedores con el mismo nombre: lo único que no se puede repetir es el RUT.",
      "Si el correo de contacto tiene un formato inválido, el guardado se rechaza.",
      "Al desactivar un proveedor que era el habitual de algún repuesto, el vínculo se conserva y la ficha del repuesto lo muestra marcado como desactivado.",
    ],
    falta: [
      "No hay evaluación de proveedores ni comparación de precios.",
      "No hay borrado: la salida es desactivar.",
    ],
  },
  {
    id: "ficha",
    nombre: "Ficha pública del QR",
    ruta: "/a/[código]",
    sirve:
      "Es la pantalla que ve quien escanea el código pegado en la máquina. Sin cuenta y sin instalar nada: identificación, estado de mantención e historial.",
    pasos: [
      {
        titulo: "Escanear con la cámara del teléfono",
        ves: "La cámara reconoce el QR y ofrece abrir el enlace. No hace falta ninguna aplicación.",
        pasa: "Abre la ficha de esa máquina y nada más. El código no sirve para llegar a otra.",
      },
      {
        titulo: "Leer la identificación",
        ves: "Arriba y grande: el tipo, el nombre, el código de flota y la patente. Debajo el estado, la ubicación y el horómetro.",
        pasa: "Lo que falta no se muestra: si la máquina no tiene ubicación cargada, esa línea no aparece.",
      },
      {
        titulo: "Ver el estado de mantención",
        ves: "Una tarjeta por plan, con franja de color, insignia, glifo y el plazo en texto: “Vence en 22 días”, “Excedida en 210 h de uso”.",
        pasa: "Vienen ordenadas por urgencia: la primera es siempre la más apremiante.",
      },
      {
        titulo: "Abrir el historial",
        ves: "Al final, “Historial de mantenciones” con la cantidad de registros. Viene cerrado y se abre tocándolo.",
        pasa: "Muestra las mantenciones completadas, de la más nueva a la más antigua, con lo que se hizo y qué repuestos se usaron.",
      },
    ],
    quien:
      "Cualquiera. No pide cuenta ni contraseña: la protección es que la dirección lleva un código aleatorio imposible de adivinar.",
    ojo: [
      "Cualquiera que tenga el link, o que le saque una foto al QR pegado en la máquina, ve esta ficha. La decisión de negocio es qué información se publica, no si pide sesión.",
      "Con la bandera de costos apagada, los montos y el nombre del proveedor no viajan. Pero el nombre de quien ejecutó la mantención internamente sí se publica.",
      "Compartir el link ya filtra datos antes de abrirlo: la previsualización de WhatsApp muestra el nombre, el código, la patente y la ubicación.",
      "El historial trae hasta 50 registros. Una máquina con 80 mantenciones muestra 50 y no avisa que hay más.",
      "Un plan desactivado desaparece de la ficha, y la pantalla dice que la máquina no tiene planes definidos.",
    ],
    falta: [
      "No se puede registrar nada desde la ficha: es solo lectura.",
      "No aparecen las mantenciones programadas ni las que están en ejecución, solo las completadas.",
    ],
  },
  {
    id: "roles",
    nombre: "Roles y permisos",
    ruta: "transversal",
    sirve:
      "Define qué puede hacer cada persona. Hay tres roles, y el que tienes se muestra arriba a la izquierda junto a tu nombre.",
    pasos: [
      {
        titulo: "Lector",
        ves: "Ve el panel completo: resumen, activos, mantenciones, repuestos y proveedores.",
        pasa: "No puede modificar nada. Si intenta, la base rechaza la operación, no solo la pantalla.",
      },
      {
        titulo: "Técnico",
        ves: "Lo del lector, más registrar mantenciones, cargar repuestos a una orden, adjuntar documentos y registrar movimientos de stock.",
        pasa: "No crea ni edita activos, no toca los maestros y no borra nada, ni una línea de repuesto mal digitada.",
      },
      {
        titulo: "Administrador",
        ves: "Todo, incluidos los maestros y el borrado.",
        pasa: "Incluso así, hay cosas que nadie puede hacer: borrar un movimiento de stock, o borrar un activo que tenga mantenciones registradas.",
      },
    ],
    quien: "El rol lo asigna un administrador por base de datos. No se cambia desde el panel.",
    ojo: [
      "Cuando un botón no aparece, casi siempre es el rol y no una falla. El bloque “Tu acceso” del resumen dice qué permite el tuyo.",
      "La seguridad no está en que el botón esté oculto: cada acción vuelve a verificar el rol, y la base de datos lo verifica otra vez. Ocultar el botón es solo para no hacerte perder el tiempo.",
      "Un perfil deshabilitado no entra al panel, aunque su contraseña sea correcta.",
    ],
    falta: [
      "La pantalla de configuración donde se administrarían usuarios y roles todavía no está construida.",
    ],
  },
];
