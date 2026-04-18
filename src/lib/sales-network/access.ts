import { SalesNetworkRole } from "@prisma/client";

/** Whether `actor` may assign `target` role on create (Nexa promotion rules separate). */
export function canCreateSalesNetworkRole(
  actor: SalesNetworkRole | null,
  target: SalesNetworkRole,
): boolean {
  if (target === SalesNetworkRole.BDM) return false;
  if (!actor || actor === SalesNetworkRole.BDE) return false;
  if (actor === SalesNetworkRole.BOSS) {
    return target === SalesNetworkRole.RSM || target === SalesNetworkRole.TECH_EXEC;
  }
  if (actor === SalesNetworkRole.RSM) {
    return target === SalesNetworkRole.BDE;
  }
  if (actor === SalesNetworkRole.BDM) {
    return false;
  }
  return false;
}

/** Super-boss API can emulate BOSS for internal org. */
export function canBossCreateRole(target: SalesNetworkRole): boolean {
  return target === SalesNetworkRole.RSM || target === SalesNetworkRole.TECH_EXEC;
}
