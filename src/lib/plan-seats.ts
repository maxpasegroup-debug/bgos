import "server-only";

import { CompanyPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Basic plan workspace seats (including the boss). */
export const BASIC_PLAN_MAX_MEMBERS = 5;

export async function countCompanyMembers(companyId: string): Promise<number> {
  return prisma.userCompany.count({ where: { companyId } });
}

export async function basicPlanMemberLimitReached(
  companyId: string,
  plan: CompanyPlan,
): Promise<boolean> {
  if (plan !== CompanyPlan.BASIC) return false;
  const n = await countCompanyMembers(companyId);
  return n >= BASIC_PLAN_MAX_MEMBERS;
}
