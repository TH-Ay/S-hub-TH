/**
 * Helpers de roles (seguros para cliente y servidor).
 * 'personas' tiene hoy los mismos permisos que 'admin'.
 * 'TI' también es administrador, pero sin datos sensibles de personas
 * (Capacity, Matriz de Talento, descarga Info personas): ver esTI().
 * Si admin se restringe, ajustar los chequeos puntuales, no ROLES_ADMIN.
 */
import type { RolSistema } from "@/lib/types/database";

/** Roles con permisos de administrador. */
export const ROLES_ADMIN: RolSistema[] = ["admin", "personas", "TI"];

export function esAdmin(rol: RolSistema | string | null | undefined): boolean {
  return ROLES_ADMIN.includes(rol as RolSistema);
}

/** Rol TI: administra, pero no ve datos sensibles de personas. */
export function esTI(rol: RolSistema | string | null | undefined): boolean {
  return rol === "TI";
}
