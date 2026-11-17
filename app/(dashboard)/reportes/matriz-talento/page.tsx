import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { esTI } from "@/lib/roles";
import { MatrizTalentoClient } from "./MatrizTalentoClient";

export default async function MatrizTalentosPage() {
  // Solo admin: el resto de los roles no debe ver la evaluación de talento
  // (ver reportes/page.tsx, allowedRoles). Antes solo se ocultaba la tarjeta;
  // entrar directo por URL no tenía ningún freno.
  const { rol } = await requireAdmin();
  // TI administra, pero no ve datos sensibles de personas
  if (esTI(rol)) redirect("/tablero?error=sin_permisos");
  return <MatrizTalentoClient />;
}
