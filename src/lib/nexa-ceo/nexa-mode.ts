import { SalesNetworkRole } from "@prisma/client";

/**
 * Nexa persona for UI + API (does not replace job roles).
 *
 * - **coach** — BDE / BDM / Tech Exec: daily tasks, lead coaching, promotions.
 * - **manager** — RSM: team coverage, regions.
 * - **ceo** — Platform boss: `/api/nexa/ceo-insights`, Command Center.
 */
export type NexaMode = "coach" | "manager" | "ceo";

export function resolveNexaMode(
  salesNetworkRole: SalesNetworkRole | null | undefined,
  isPlatformBoss: boolean,
): NexaMode {
  if (isPlatformBoss) return "ceo";
  if (salesNetworkRole === SalesNetworkRole.RSM) return "manager";
  if (
    salesNetworkRole === SalesNetworkRole.BDM ||
    salesNetworkRole === SalesNetworkRole.BDE ||
    salesNetworkRole === SalesNetworkRole.TECH_EXEC
  ) {
    return "coach";
  }
  return "coach";
}
