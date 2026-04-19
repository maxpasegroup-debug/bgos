import "server-only";

import { SalesBenefitLevel, SalesNetworkRole, UserRole, type PrismaClient } from "@prisma/client";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";

export type InternalMembershipContext =
  | {
      ok: true;
      companyId: string;
      salesNetworkRole: SalesNetworkRole | null;
      userCompany: {
        salesNetworkRole: SalesNetworkRole | null;
        jobRole: UserRole;
        parentUserId: string | null;
        region: string | null;
        archivedAt: Date | null;
        activeSubscriptionsCount: number;
        totalPoints: number;
        bdeSlotLimit: number;
        benefitLevel: SalesBenefitLevel | null;
        user: { id: string; name: string | null; email: string };
      };
    }
  | { ok: false; error: string; code: "INTERNAL_ORG" | "NOT_MEMBER" };

async function fetchMembership(prisma: PrismaClient, companyId: string, userId: string) {
  return prisma.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: {
      salesNetworkRole: true,
      jobRole: true,
      parentUserId: true,
      region: true,
      archivedAt: true,
      activeSubscriptionsCount: true,
      totalPoints: true,
      bdeSlotLimit: true,
      benefitLevel: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

/**
 * Resolves the platform internal sales org and the caller's membership row.
 */
export async function getInternalMembership(
  prisma: PrismaClient,
  userId: string,
): Promise<InternalMembershipContext> {
  const org = await getOrCreateInternalSalesCompanyId();
  if ("error" in org) {
    return { ok: false, error: org.error, code: "INTERNAL_ORG" };
  }
  const row = await fetchMembership(prisma, org.companyId, userId);
  if (!row || row.archivedAt) {
    return { ok: false, error: "Not a member of the internal org", code: "NOT_MEMBER" };
  }
  return {
    ok: true,
    companyId: org.companyId,
    salesNetworkRole: row.salesNetworkRole,
    userCompany: row,
  };
}

export function parseSalesNetworkRoleQuery(q: string | null): SalesNetworkRole | null {
  if (!q || !q.trim()) return null;
  const u = q.trim().toUpperCase();
  const map: Record<string, SalesNetworkRole> = {
    INTERNAL_BDE: SalesNetworkRole.BDE,
    INTERNAL_BDM: SalesNetworkRole.BDM,
    INTERNAL_RSM: SalesNetworkRole.RSM,
    INTERNAL_BOSS: SalesNetworkRole.BOSS,
    BDE: SalesNetworkRole.BDE,
    BDM: SalesNetworkRole.BDM,
    RSM: SalesNetworkRole.RSM,
    BOSS: SalesNetworkRole.BOSS,
    TECH_EXEC: SalesNetworkRole.TECH_EXEC,
  };
  return map[u] ?? (Object.values(SalesNetworkRole).includes(u as SalesNetworkRole) ? (u as SalesNetworkRole) : null);
}
