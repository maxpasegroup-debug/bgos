import "server-only";

import type { CompanyPlan, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type JwtMembershipRow = {
  companyId: string;
  plan: CompanyPlan;
  jobRole: UserRole;
  trialEndsAt: string | null;
  subscriptionPeriodEnd: string | null;
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
          // Present on Company after billing migration — run `npx prisma generate` when the engine isn’t locked.
          subscriptionPeriodEnd: true,
        } as { plan: true; trialEndDate: true; subscriptionPeriodEnd: true },
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
      trialEndsAt: r.company.trialEndDate?.toISOString() ?? null,
      subscriptionPeriodEnd: co.subscriptionPeriodEnd?.toISOString() ?? null,
    };
  });
}
