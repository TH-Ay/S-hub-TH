import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { esTI } from "@/lib/roles";
import { CapacityProyectosClient } from "./CapacityProyectosClient";

export default async function CapacityProyectosPage() {
  const { rol } = await requireAuth();
  // TI no ve reportes de capacity ni dotación
  if (esTI(rol)) redirect("/reportes?error=sin_permisos");
  return <CapacityProyectosClient />;
}
