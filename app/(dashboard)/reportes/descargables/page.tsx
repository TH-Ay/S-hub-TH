import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { esTI } from "@/lib/roles";
import { DescargablesClient } from "./DescargablesClient";

export default async function DescargablesPage() {
  const { rol } = await requireAdmin();
  // TI no entra a Descargables, ni por enlace directo
  if (esTI(rol)) redirect("/reportes?error=sin_permisos");
  return <DescargablesClient />;
}
