import type { PrismaClient } from "@prisma/client";
import { SalesNetworkRole } from "@prisma/client";
import { runSalesHierarchyPromotions } from "@/lib/sales-hierarchy/promotion-v1";

/**
 * BDE → BDM when active subscription count ≥ threshold (see `config/sales-hierarchy.ts`).
 * Legacy streak-based path removed — Nexa uses {@link runSalesHierarchyPromotions}.
 */
export async function evaluateBdeToBdmPromotion(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
): Promise<{ eligible: boolean; streak: number }> {
  const before = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { salesNetworkRole: true },
  });
  if (before?.salesNetworkRole !== SalesNetworkRole.BDE) {
    return { eligible: false, streak: 0 };
  }
  await runSalesHierarchyPromotions(prisma, companyId);
  const after = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { salesNetworkRole: true },
  });
  return {
    eligible: after?.salesNetworkRole === SalesNetworkRole.BDM,
    streak: 0,
  };
}
