import "server-only";

import { CompanyPlan, CompanySubscriptionStatus } from "@prisma/client";
import { isBasicTrialExpired } from "@/lib/trial";
import { prisma } from "@/lib/prisma";

export type CompanySubscriptionFields = {
  plan: CompanyPlan;
  trialEndDate: Date | null;
};

/**
 * Derived status from plan + trial window (single source of truth for expiry).
 */
export function deriveSubscriptionStatus(company: CompanySubscriptionFields): CompanySubscriptionStatus {
  if (company.plan !== CompanyPlan.BASIC) return CompanySubscriptionStatus.ACTIVE;
  if (!company.trialEndDate) return CompanySubscriptionStatus.ACTIVE;
  if (isBasicTrialExpired(company)) return CompanySubscriptionStatus.EXPIRED;
  return CompanySubscriptionStatus.TRIAL;
}

/** Full 24h buckets remaining until trial end (minimum 1 while still before end). */
export function trialDaysRemaining(trialEndDate: Date | null): number | null {
  if (!trialEndDate) return null;
  const ms = trialEndDate.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export async function syncCompanySubscriptionStatus(companyId: string): Promise<CompanySubscriptionStatus> {
  const row = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true, trialEndDate: true, subscriptionStatus: true },
  });
  if (!row) return CompanySubscriptionStatus.ACTIVE;
  const next = deriveSubscriptionStatus(row);
  if (row.subscriptionStatus !== next) {
    await prisma.company.update({
      where: { id: companyId },
      data: { subscriptionStatus: next },
    });
  }
  return next;
}
