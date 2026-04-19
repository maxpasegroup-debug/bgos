/**
 * Default app paths for internal sales hierarchy (JWT `salesNetworkRole`).
 */

import { isBossReady } from "@/lib/boss-ready";
import { getRoleHome, SUPER_BOSS_HOME_PATH, TECH_EXEC_HOME_PATH } from "@/lib/role-routing";
import { BGOS_BOSS_READY_HOME } from "@/lib/system-readiness";
import { isSuperBossEmail } from "@/lib/super-boss";

export function dashboardHomeFromSalesNetworkRole(
  snr: string | null | undefined,
): string | null {
  switch (snr) {
    case "BDE":
      return "/dashboard/bde";
    case "BDM":
      return "/dashboard/bdm";
    case "RSM":
      return "/dashboard/rsm";
    case "TECH_EXEC":
      return "/dashboard/tech";
    default:
      return null;
  }
}

/**
 * Post-login / middleware home resolution using JWT claims (Edge-safe fields only).
 */
export function redirectHomeFromJwtPayload(payload: Record<string, unknown>): string {
  const email = typeof payload.email === "string" ? payload.email : "";
  const workspaceReady = payload.workspaceReady !== false;
  const companyId =
    typeof payload.companyId === "string" && payload.companyId.length > 0
      ? payload.companyId
      : null;
  const role = String(payload.role ?? "ADMIN");

  if (payload.superBoss === true && isSuperBossEmail(email)) {
    return SUPER_BOSS_HOME_PATH;
  }

  if (payload.isInternal === true) {
    const snr = typeof payload.salesNetworkRole === "string" ? payload.salesNetworkRole : null;
    if (
      snr === "TECH_EXEC" ||
      role === "TECH_EXECUTIVE" ||
      role === "TECH_HEAD"
    ) {
      return "/internal/tech";
    }
    if (snr === "BOSS") {
      return "/internal/control";
    }
    if (snr === "BDE" || snr === "BDM" || snr === "RSM") {
      return "/internal/sales";
    }
    return "/internal/sales";
  }

  const snr = typeof payload.salesNetworkRole === "string" ? payload.salesNetworkRole : null;
  const snrHome = dashboardHomeFromSalesNetworkRole(snr);
  if (snrHome && workspaceReady && companyId) {
    return snrHome;
  }

  if (role === "TECH_EXECUTIVE") {
    return TECH_EXEC_HOME_PATH;
  }

  if (isBossReady(role, companyId) && workspaceReady) {
    return BGOS_BOSS_READY_HOME;
  }

  return getRoleHome(role);
}
