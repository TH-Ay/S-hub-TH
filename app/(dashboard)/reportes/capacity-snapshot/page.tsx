import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { esTI } from "@/lib/roles";
import { CapacitySnapshotClient } from "./CapacitySnapshotClient";

export default async function CapacitySnapshotPage() {
  const { rol } = await requireAuth();
  // TI no ve reportes de capacity ni dotación
  if (esTI(rol)) redirect("/reportes?error=sin_permisos");
  return <CapacitySnapshotClient />;
}
