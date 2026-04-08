import "server-only";

import type { CompanyPlan, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type JwtMembershipRow = {
  companyId: string;
  plan: CompanyPlan;
  jobRole: UserRole;
  trialEndsAt: string | null;
};

/**
 * Loads all company memberships for JWT claims (login, token refresh, company create).
 */
export async function loadMembershipsForJwt(userId: string): Promise<JwtMembershipRow[]> {
  const rows = await prisma.userCompany.findMany({
    where: { userId },
    include: { company: { select: { plan: true, trialEndDate: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    companyId: r.companyId,
    plan: r.company.plan,
    jobRole: r.jobRole,
    trialEndsAt: r.company.trialEndDate?.toISOString() ?? null,
  }));
}
