import type { CompanyPlan, CompanySubscriptionStatus } from "@prisma/client";

export type BossControlClientCategory = "TRIAL" | "BASIC" | "PRO" | "ENTERPRISE" | "LOST";

export function bossControlClientCategory(input: {
  internalSalesOrg: boolean;
  plan: CompanyPlan;
  subscriptionStatus: CompanySubscriptionStatus;
  isTrialActive: boolean;
}): BossControlClientCategory | null {
  if (input.internalSalesOrg) return null;
  if (input.subscriptionStatus === "EXPIRED") return "LOST";
  if (input.subscriptionStatus === "TRIAL") return "TRIAL";
  if (input.subscriptionStatus === "ACTIVE") {
    if (input.plan === "ENTERPRISE") return "ENTERPRISE";
    if (input.plan === "PRO") return "PRO";
    return "BASIC";
  }
  if (input.isTrialActive) return "TRIAL";
  return "LOST";
}
