import type { PrismaClient } from "@prisma/client";
import { SalesBenefitLevel, SalesNetworkRole } from "@prisma/client";
import { BDM_FULL_MIN, BDM_GRACE_LOW } from "@/config/sales-hierarchy";

/**
 * BDM benefit band based on active subscription count (grace system).
 */
export function benefitLevelForBdmCount(activeCount: number): SalesBenefitLevel {
  if (activeCount >= BDM_FULL_MIN) return SalesBenefitLevel.FULL;
  if (activeCount >= BDM_GRACE_LOW) return SalesBenefitLevel.GRACE;
  return SalesBenefitLevel.REDUCED;
}

export async function refreshBdmBenefitLevel(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
): Promise<void> {
  const m = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { salesNetworkRole: true, activeSubscriptionsCount: true },
  });
  if (!m || m.salesNetworkRole !== SalesNetworkRole.BDM) return;
  const level = benefitLevelForBdmCount(m.activeSubscriptionsCount);
  await prisma.userCompany.update({
    where: { userId_companyId: { userId, companyId } },
    data: { benefitLevel: level },
  });
}
