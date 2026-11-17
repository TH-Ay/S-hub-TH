import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { esTI } from "@/lib/roles";
import { CapacityClient } from "./CapacityClient";

export default async function CapacityPage() {
  // Solo admin y Personas (igual que el menú lateral): antes cualquier rol entraba por
  // enlace directo y podía escribir valores que la base rechazaba sin avisar
  const { rol } = await requireAdmin();
  // TI administra, pero no ve datos sensibles de personas
  if (esTI(rol)) redirect("/tablero?error=sin_permisos");
  return <CapacityClient />;
}
