import { notFound, redirect } from "next/navigation";
import { perfilHabilitado } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

/*
  Puente del QR a la ficha privada.

  Para que existe: la ficha publica que abre el codigo QR no conoce el id
  interno del activo, solo su token, y eso es deliberado. get_ficha_publica no
  devuelve el id porque publicar un identificador interno a una pagina anonima
  no aporta nada y amplia la superficie. Pero quien trabaja aqui, parado frente
  a la maquina con el telefono, necesita poder saltar de esa ficha al detalle
  completo sin ir a buscar la maquina en un listado de cuarenta.

  Esta ruta resuelve el token contra la base CON LA SESION de quien entra, asi
  que RLS decide si la fila es visible. Vive bajo /admin, o sea dentro del
  matcher del proxy: sin sesion se va a /login y vuelve aca despues de entrar.
  No expone nada nuevo, porque el token ya venia en la direccion que la persona
  estaba mirando.

  Un token que no existe responde 404 igual que la ficha publica. Responder
  distinto permitiria averiguar si un token es valido sin poder verlo.
*/
export const dynamic = "force-dynamic";

export default async function PuenteQrPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const perfil = await perfilHabilitado();
  if (!perfil) redirect("/login");

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("activos")
    .select("id")
    .eq("qr_token", token)
    .maybeSingle();

  if (error) {
    console.error("No pude resolver el token del QR:", error.message);
    notFound();
  }
  if (!data) notFound();

  redirect(`/admin/activos/${(data as { id: string }).id}`);
}
