import "server-only";

import { CompanyPlan, CompanySubscriptionStatus } from "@prisma/client";

const BASIC_MONTHLY = "₹6,000/month";
const PRO_MONTHLY = "₹12,000/month";

export function planAmountLabel(
  plan: CompanyPlan,
  subscriptionStatus: CompanySubscriptionStatus,
): string {
  if (plan === CompanyPlan.ENTERPRISE) return "Custom pricing";
  if (plan === CompanyPlan.PRO) return PRO_MONTHLY;
  if (plan === CompanyPlan.BASIC) {
    if (subscriptionStatus === CompanySubscriptionStatus.TRIAL) {
      return `Free trial · then ${BASIC_MONTHLY}`;
    }
    return BASIC_MONTHLY;
  }
  return BASIC_MONTHLY;
}

/**
 * Next charge or trial conversion date; null when unknown (e.g. paid Pro without billing integration).
 */
export function nextBillingDateIso(params: {
  plan: CompanyPlan;
  subscriptionStatus: CompanySubscriptionStatus;
  trialEndDate: Date | null;
}): string | null {
  const { plan, subscriptionStatus, trialEndDate } = params;
  if (subscriptionStatus === CompanySubscriptionStatus.TRIAL && trialEndDate) {
    return trialEndDate.toISOString();
  }
  if (plan === CompanyPlan.BASIC && subscriptionStatus === CompanySubscriptionStatus.EXPIRED && trialEndDate) {
    return trialEndDate.toISOString();
  }
  return null;
}
