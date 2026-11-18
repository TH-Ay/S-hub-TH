import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { esTI } from "@/lib/roles";
import { ResumenAnualClient } from "./ResumenAnualClient";

export default async function ResumenAnualPersonasPage() {
  const { rol } = await requireAuth();
  // Igual que capacity: TI no ve reportes de staffing por persona
  if (esTI(rol)) redirect("/reportes?error=sin_permisos");
  return <ResumenAnualClient />;
}
