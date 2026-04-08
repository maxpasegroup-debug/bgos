import type { CompanyPlan } from "@prisma/client";

/** Runtime plan constants (safe where `CompanyPlan.PRO` is not a JS value). */
export const PLAN = {
  BASIC: "BASIC",
  PRO: "PRO",
  ENTERPRISE: "ENTERPRISE",
} as const;

export type PaidPlan = typeof PLAN.PRO | typeof PLAN.ENTERPRISE;

export function planRank(plan: CompanyPlan | (typeof PLAN)[keyof typeof PLAN]): number {
  switch (plan) {
    case "BASIC":
      return 0;
    case "PRO":
      return 1;
    case "ENTERPRISE":
      return 2;
    default:
      return 0;
  }
}
