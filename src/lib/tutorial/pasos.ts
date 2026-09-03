/*
  Pasos del recorrido guiado.

  Cada paso apunta a un elemento REAL de la interfaz por su atributo
  data-tour. Eso es lo que distingue un tutorial guiado de un manual: el texto
  no describe una pantalla, senala la pantalla.

  Consecuencia que hay que respetar al mantener esto: si se renombra o se borra
  un data-tour, el paso queda huerfano. El recorrido no se rompe (cae a una
  tarjeta centrada con el mismo texto), pero pierde justamente lo que lo hace
  util. Por eso existe scripts/verifica-tutorial.mjs, que comprueba que cada
  ancla exista en el codigo.

  El contenido salio de la auditoria de las nueve secciones: un agente por
  seccion leyendo el codigo y un esceptico refutando su descripcion. Los textos
  estan recortados a lo que se puede leer de pie frente a la pantalla, no a lo
  que cabe en un manual.
*/

export type PasoTutorial = {
  id: string;
  /** Ruta donde vive el paso. El recorrido navega solo si hace falta. */
  ruta: string;
  /**
   * Valor del atributo data-tour del elemento a destacar. Sin ancla, el paso se
   * muestra centrado: sirve para bienvenida y cierre.
   */
  ancla?: string;
  titulo: string;
  texto: string;
  /**
   * Advertencia. Se pinta con la franja de acento porque son los avisos que
   * evitan perder trabajo, no informacion de relleno.
   */
  ojo?: string;
  /**
   * Paso que solo ve un administrador. No es cosmetico: la pantalla a la que
   * apunta redirige a quien no tenga el rol, y un paso que lleva a una
   * redireccion deja el recorrido senalando el vacio.
   */
  soloAdmin?: boolean;
};

export const PASOS_TUTORIAL: PasoTutorial[] = [
  {
    id: "bienvenida",
    ruta: "/admin",
    titulo: "Te muestro el panel en dos minutos",
    texto:
      "Cada máquina lleva un código QR pegado. Quien lo escanea ve su ficha de mantención sin necesidad de cuenta. Este panel es donde se cargan las máquinas, se imprimen sus códigos y se registra lo que se les hace. Avanza con Siguiente o con la flecha derecha.",
  },
  {
    id: "identidad",
    ruta: "/admin",
    ancla: "identidad",
    titulo: "Acá ves quién eres y qué puedes hacer",
    texto:
      "Tu nombre y, al lado, tu rol. Hay tres: Lector solo mira, Técnico registra mantenciones y movimientos de stock, y Administrador puede además crear máquinas y tocar los maestros.",
    ojo: "Cuando un botón no aparece, casi siempre es tu rol y no una falla del sistema.",
  },
  {
    id: "nav",
    ruta: "/admin",
    ancla: "nav",
    titulo: "Las secciones del panel",
    texto:
      "Siete secciones, de Resumen a Configuración. El menú muestra solo lo que tu rol puede abrir: si eres Lector o Técnico, Configuración no aparece. En el teléfono esta fila se desliza en vez de ocupar tres líneas.",
  },
  {
    id: "semaforo",
    ruta: "/admin",
    ancla: "resumen-semaforo",
    titulo: "El semáforo de la flota",
    texto:
      "Cuatro estados: vencida, crítica, próxima y al día. Cada tarjeta cuenta planes de mantención, no máquinas: una máquina con tres planes puede aparecer en tres tarjetas distintas.",
    ojo: "Vencida y crítica comparten el color y se distinguen por la forma del ícono. Es a propósito: en terreno, con sol encima, el color es lo primero que se pierde.",
  },
  {
    id: "indicadores",
    ruta: "/admin",
    ancla: "resumen-indicadores",
    titulo: "Tres números de contexto",
    texto:
      "Planes que el sistema está calculando, máquinas fuera de servicio y repuestos bajo el mínimo. Este último es el único que suele exigir hacer algo hoy.",
    ojo: "Los números no se pueden pinchar, pero la tabla que viene abajo ya responde cuáles son.",
  },
  {
    id: "criticidad",
    ruta: "/admin",
    ancla: "resumen-criticidad",
    titulo: "Qué atender primero",
    texto:
      "Los planes ordenados por urgencia: primero lo vencido, y dentro de cada grupo lo que vence antes. Cada fila lleva directo a registrar esa mantención, con la máquina y el plan ya elegidos.",
    ojo: "Muestra los 12 más críticos. Si quedan más, lo dice al pie; el resto se ve en Activos filtrando por semáforo.",
  },
  {
    id: "gasto",
    ruta: "/admin",
    ancla: "resumen-gasto",
    titulo: "Cuánto cuesta mantener la flota",
    texto:
      "El gasto total y cómo se reparte entre máquinas. El botón del ojo abre el resumen de esa máquina: sus datos, cuánto lleva gastado y el gráfico de gasto mes a mes y acumulado.",
    ojo: "Solo cuenta mantenciones completadas y con fecha de ejecución. Una orden programada todavía no costó nada.",
  },
  {
    id: "activos-lista",
    ruta: "/admin/activos",
    ancla: "activos-lista",
    titulo: "El inventario de la flota",
    texto:
      "Una tarjeta por máquina, con su estado de mantención a la vista. El semáforo de una máquina es el peor de sus planes: si uno está vencido, la máquina está vencida aunque los otros dos estén al día.",
  },
  {
    id: "activos-filtros",
    ruta: "/admin/activos",
    ancla: "activos-filtros",
    titulo: "Filtrar sin perder el filtro",
    texto:
      "Tipo, estado, ubicación y semáforo. El filtro queda guardado en la dirección del navegador, así que puedes mandarle a alguien el link de “todo lo vencido en el fundo El Roble” y el botón atrás funciona.",
  },
  {
    id: "activos-nuevo",
    ruta: "/admin/activos",
    ancla: "activos-nuevo",
    titulo: "Cargar una máquina nueva",
    texto:
      "Solo cuatro campos son obligatorios: nombre, código interno, tipo y estado. El código QR se genera solo y al guardar te deja directo en la etiqueta, lista para imprimir.",
    ojo: "Sin horómetro cargado, los planes por horas de uso detectan el vencimiento pero no pueden anticiparlo en días.",
  },
  {
    id: "etiquetas-base",
    ruta: "/admin/activos/etiquetas",
    ancla: "etiquetas-base",
    titulo: "Antes de imprimir, mira esta dirección",
    texto:
      "Es la dirección que va a quedar dentro de cada código. Este recuadro es el único control real: si el dominio cambia después, cada etiqueta pegada queda muerta y hay que reimprimir y volver a pegar una por una.",
  },
  {
    id: "etiquetas-seleccion",
    ruta: "/admin/activos/etiquetas",
    ancla: "etiquetas-seleccion",
    titulo: "Elegir qué imprimir y cuántas copias",
    texto:
      "Una casilla por máquina y copias de 1 a 20. Dos copias sirven: una para la máquina y otra para la carpeta de mantención. El contador de arriba cuenta etiquetas, no máquinas.",
    ojo: "Apretar “Actualizar la vista previa” es obligatorio. Marcar casillas no cambia nada hasta hacerlo, y si aprietas Imprimir directo sale la tanda anterior. Es la forma más fácil de perder una hoja.",
  },
  {
    id: "mantenciones-lista",
    ruta: "/admin/mantenciones",
    ancla: "mant-filtros",
    titulo: "El libro de vida de la flota",
    texto:
      "Cada intervención con su fecha, quién la hizo, qué repuestos se usaron y cuánto costó. El listado trae las 200 más recientes; para llegar a las antiguas hay que acotar el rango de fechas.",
    ojo: "El total en pesos es la suma de lo que se está mostrando, no el gasto histórico de la flota.",
  },
  {
    id: "mantenciones-nueva",
    ruta: "/admin/mantenciones",
    ancla: "mant-nueva",
    titulo: "Registrar una mantención",
    texto:
      "Primero se crea la orden y después se le cargan los repuestos y la factura. Al cargar un repuesto del maestro, el sistema descuenta el stock solo y recalcula el costo: esos números no se escriben a mano.",
    ojo: "Para que una mantención mueva el semáforo tiene que llevar plan, ser preventiva, quedar completada y tener fecha de ejecución. Una correctiva no lo mueve nunca.",
  },
  {
    id: "repuestos-alerta",
    ruta: "/admin/repuestos",
    ancla: "rep-libro",
    titulo: "El libro de stock es de solo agregar",
    texto:
      "Ni un administrador puede borrar una fila. Una corrección se hace con un ajuste que compensa, y ese ajuste queda registrado. Así el inventario se puede auditar hacia atrás.",
    ojo: "El consumo no se registra acá: lo genera la orden de mantención al cargarle repuestos. Registrarlo a mano lo descontaría dos veces.",
  },
  {
    id: "reportes",
    ruta: "/admin/reportes",
    ancla: "reportes-tipo",
    titulo: "Preventiva contra correctiva",
    texto:
      "Dos barras que miden lo mismo de dos maneras: cuántas órdenes y cuánta plata. Cuando la correctiva pesa más en costo que en cantidad, cada falla no planificada está saliendo más cara que una mantención programada.",
    ojo: "El filtro de fechas de arriba manda sobre los tres cortes a la vez. Todo lo que se ve acá cuenta solo órdenes completadas y con fecha de ejecución.",
  },
  {
    id: "config-costos",
    ruta: "/admin/configuracion",
    ancla: "config-costos",
    soloAdmin: true,
    titulo: "El interruptor que hay que pensar dos veces",
    texto:
      "Enciende y apaga la publicación de los costos en la ficha del QR. En esta misma pantalla se cambian los umbrales del semáforo y los roles de cada persona.",
    ojo: "La ficha pública no pide cuenta. Con esto encendido, cualquiera que escanee la etiqueta ve cuánto costó cada mantención.",
  },
  {
    id: "cierre",
    ruta: "/admin",
    titulo: "Eso es todo",
    texto:
      "Puedes volver a ver este recorrido cuando quieras, con el botón Tutorial del encabezado. Ningún paso te deja a medias: el elemento destacado sigue funcionando mientras lo miras.",
    ojo: "La ficha que abre el QR es pública: cualquiera con el link, o con una foto de la etiqueta, la ve. Vale saberlo antes de decidir qué información se publica ahí.",
  },
];
