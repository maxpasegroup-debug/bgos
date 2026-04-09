import "server-only";

import { CompanyPlan, CompanySubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CompanySubscriptionFields = {
  plan: CompanyPlan;
  trialEndDate: Date | null;
  subscriptionPeriodEnd: Date | null;
};

/**
 * Single source of truth for subscription status (trial / active paid period / expired).
 */
export function deriveSubscriptionStatus(company: CompanySubscriptionFields): CompanySubscriptionStatus {
  if (company.plan === CompanyPlan.ENTERPRISE) {
    return CompanySubscriptionStatus.ACTIVE;
  }

  const periodEndMs = company.subscriptionPeriodEnd?.getTime() ?? null;
  if (periodEndMs != null && Date.now() < periodEndMs) {
    return CompanySubscriptionStatus.ACTIVE;
  }

  if (company.plan === CompanyPlan.PRO) {
    if (!company.subscriptionPeriodEnd) {
      return CompanySubscriptionStatus.ACTIVE;
    }
    return CompanySubscriptionStatus.EXPIRED;
  }

  if (company.plan !== CompanyPlan.BASIC) {
    return CompanySubscriptionStatus.ACTIVE;
  }

  if (!company.trialEndDate) {
    return CompanySubscriptionStatus.ACTIVE;
  }

  if (Date.now() < company.trialEndDate.getTime()) {
    return CompanySubscriptionStatus.TRIAL;
  }

  return CompanySubscriptionStatus.EXPIRED;
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
    select: {
      plan: true,
      trialEndDate: true,
      subscriptionPeriodEnd: true,
      subscriptionStatus: true,
    },
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
