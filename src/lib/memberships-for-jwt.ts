import "server-only";

import type {
  CompanyPlan,
  CompanySubscriptionStatus,
  SalesNetworkRole,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type JwtMembershipRow = {
  companyId: string;
  plan: CompanyPlan;
  jobRole: UserRole;
  /** Sales network role for this membership (internal hierarchy). */
  salesNetworkRole: SalesNetworkRole | null;
  trialEndsAt: string | null;
  subscriptionPeriodEnd: string | null;
  /** Mirrors {@link Company.subscriptionStatus} for Edge billing holds (e.g. custom PAYMENT_PENDING). */
  subscriptionStatus: CompanySubscriptionStatus;
};

/**
 * Loads all company memberships for JWT claims (login, token refresh, company create).
 */
export async function loadMembershipsForJwt(userId: string): Promise<JwtMembershipRow[]> {
  const rows = await prisma.userCompany.findMany({
    where: { userId },
    include: {
      company: {
        select: {
          plan: true,
          trialEndDate: true,
          subscriptionPeriodEnd: true,
          subscriptionStatus: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => {
    const co = r.company as typeof r.company & { subscriptionPeriodEnd?: Date | null };
    return {
      companyId: r.companyId,
      plan: r.company.plan,
      jobRole: r.jobRole,
      salesNetworkRole: r.salesNetworkRole ?? null,
      trialEndsAt: r.company.trialEndDate?.toISOString() ?? null,
      subscriptionPeriodEnd: co.subscriptionPeriodEnd?.toISOString() ?? null,
      subscriptionStatus: r.company.subscriptionStatus,
    };
  });
}
