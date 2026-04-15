import "server-only";

import { CompanySubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AccrueMicroFranchiseCommissionInput = {
  companyId: string;
  amountPaise: number;
  paymentRef: string;
};

/**
 * On successful subscription payment: credit micro-franchise partner wallet (pending) + transaction row.
 * Idempotent on `paymentRef`.
 */
export async function accrueMicroFranchiseCommission(
  input: AccrueMicroFranchiseCommissionInput,
): Promise<{ credited: boolean }> {
  const amountRupees = input.amountPaise / 100;
  if (!Number.isFinite(amountRupees) || amountRupees <= 0) return { credited: false };

  try {
    const credited = await prisma.$transaction(async (tx) => {
      const dup = await tx.commissionTransaction.findUnique({
        where: { paymentRef: input.paymentRef },
        select: { id: true },
      });
      if (dup) return false;

      const company = await tx.company.findUnique({
        where: { id: input.companyId },
        select: {
          id: true,
          microFranchisePartnerId: true,
          subscriptionStatus: true,
        },
      });
      console.log("🔍 COMPANY CHECK:", company);
      if (!company?.microFranchisePartnerId) {
        throw new Error("❌ No MF partner linked to company");
      }

      console.log("🔥 Commission Triggered:", {
        companyId: input.companyId,
        partnerId: company.microFranchisePartnerId,
        amountPaise: input.amountPaise,
      });

      const partner = (await tx.microFranchisePartner.findUnique({
        where: { id: company.microFranchisePartnerId },
        select: {
          id: true,
          tier: true,
          performanceScore: true,
          commissionPlan: {
            select: { type: true, value: true, recurring: true, instantBonus: true },
          },
        } as any,
      })) as any;
      if (!partner) return false;

      const plan = partner.commissionPlan;
      if (!plan) {
        throw new Error("❌ No commission plan found");
      }

      let commission = 0;
      if (plan.type === "PERCENTAGE") {
        commission = (amountRupees * plan.value) / 100;
      } else if (plan.type === "FIXED") {
        commission = plan.value;
      } else {
        commission = 0;
      }

      // Auto commission boost rules based on partner tier/performance.
      let boostFactor = 1;
      if (partner.tier === "GOLD") boostFactor += 0.05;
      if (partner.tier === "PLATINUM") boostFactor += 0.1;
      if (partner.performanceScore >= 90) boostFactor += 0.03;
      commission = Math.round(commission * boostFactor * 100) / 100;

      if (!Number.isFinite(commission) || commission <= 0) return false;

      const priorForCompany = await tx.commissionTransaction.count({
        where: { companyId: company.id, partnerId: partner.id },
      });
      if (plan.instantBonus && priorForCompany === 0 && plan.instantBonus > 0) {
        commission += plan.instantBonus;
      }

      const txType = plan.recurring ? "RECURRING" : "ONE_TIME";

      await tx.commissionTransaction.create({
        data: {
          partnerId: partner.id,
          companyId: company.id,
          amount: commission,
          type: txType,
          status: "PENDING",
          paymentRef: input.paymentRef,
        },
      });

      await tx.wallet.update({
        where: { partnerId: partner.id },
        data: {
          pending: { increment: commission },
          totalEarned: { increment: commission },
        },
      });
      console.log("💰 Commission Added:", commission);

      return true;
    });
    return { credited };
  } catch (e) {
    console.error("[micro-franchise] accrueMicroFranchiseCommission", e);
    return { credited: false };
  }
}

/** Count active referred companies (paid / non-expired trial heuristic). */
export async function countPartnerActiveCustomers(partnerId: string): Promise<number> {
  return prisma.company.count({
    where: {
      microFranchisePartnerId: partnerId,
      OR: [
        { subscriptionStatus: CompanySubscriptionStatus.ACTIVE },
        { subscriptionStatus: CompanySubscriptionStatus.TRIAL, isTrialActive: true },
      ],
    },
  });
}
