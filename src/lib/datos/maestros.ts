import { crearClienteServidor } from "@/lib/supabase/server";

/*
  Maestros de repuestos y proveedores.

  El stock nunca se escribe a mano en repuestos.stock_actual: se escribe en
  movimientos_stock y un trigger actualiza el saldo. Esa es la razon de que
  movimientos_stock sea append only, y por eso una correccion se hace con un
  ajuste compensatorio en vez de un UPDATE. El libro tiene que poder auditarse.
*/

export type Repuesto = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  unidad_medida: string;
  stock_actual: number;
  stock_minimo: number;
  costo_unitario_referencia: number;
  proveedor_habitual_id: string | null;
  activo: boolean;
  proveedor_nombre: string | null;
  /** True cuando el saldo esta bajo el minimo definido. */
  bajo_minimo: boolean;
};

export type Proveedor = {
  id: string;
  nombre: string;
  rut: string | null;
  giro: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  direccion: string | null;
  notas: string | null;
  activo: boolean;
};

export type MovimientoStock = {
  id: string;
  repuesto_id: string;
  tipo: "ingreso" | "consumo" | "ajuste";
  cantidad: number;
  orden_id: string | null;
  motivo: string | null;
  created_at: string;
  repuesto_nombre: string | null;
  repuesto_codigo: string | null;
};

export const UNIDADES = ["unidad", "litro", "kilo", "metro", "juego"] as const;

export async function listarRepuestosCompleto(): Promise<{
  repuestos: Repuesto[];
  error: string | null;
}> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("repuestos")
    .select("*, proveedores(nombre)")
    .order("codigo");

  if (error) return { repuestos: [], error: error.message };

  type Fila = Omit<Repuesto, "proveedor_nombre" | "bajo_minimo"> & {
    proveedores: { nombre: string } | null;
  };

  const repuestos = ((data ?? []) as Fila[]).map((r) => ({
    ...r,
    proveedor_nombre: r.proveedores?.nombre ?? null,
    /*
      La comparacion se hace aca y no en la consulta porque el cliente de
      Supabase compara una columna contra un valor, no dos columnas entre si.
      Con un maestro de repuestos esto es irrelevante; si creciera mucho, se
      convierte en una columna generada o en una vista.
    */
    bajo_minimo: Number(r.stock_actual) < Number(r.stock_minimo),
  }));

  return { repuestos, error: null };
}

export async function listarProveedoresCompleto(): Promise<{
  proveedores: Proveedor[];
  error: string | null;
}> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("proveedores").select("*").order("nombre");
  if (error) return { proveedores: [], error: error.message };
  return { proveedores: (data ?? []) as Proveedor[], error: null };
}

export async function listarMovimientos(
  repuestoId?: string,
): Promise<{ movimientos: MovimientoStock[]; error: string | null }> {
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("movimientos_stock")
    .select("*, repuestos(nombre, codigo)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (repuestoId) consulta = consulta.eq("repuesto_id", repuestoId);

  const { data, error } = await consulta;
  if (error) return { movimientos: [], error: error.message };

  type Fila = Omit<MovimientoStock, "repuesto_nombre" | "repuesto_codigo"> & {
    repuestos: { nombre: string; codigo: string } | null;
  };

  const movimientos = ((data ?? []) as Fila[]).map((m) => ({
    ...m,
    repuesto_nombre: m.repuestos?.nombre ?? null,
    repuesto_codigo: m.repuestos?.codigo ?? null,
  }));

  return { movimientos, error: null };
}
