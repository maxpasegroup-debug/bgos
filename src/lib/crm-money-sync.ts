import "server-only";

import { DealStatus, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * When a quotation is marked APPROVED, move the linked lead to Proposal Won (unless closed).
 */
export async function syncLeadOnQuotationApproved(companyId: string, leadId: string | null) {
  if (!leadId) return;
  await prisma.lead.updateMany({
    where: {
      id: leadId,
      companyId,
      status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
    },
    data: { status: LeadStatus.PROPOSAL_WON },
  });
}

/**
 * When an invoice is fully paid, close the loop: lead Won + deal row marked won.
 */
export async function syncLeadAndDealOnInvoicePaid(
  companyId: string,
  leadId: string | null,
  dealValue: number,
) {
  if (!leadId) return;

  await prisma.lead.updateMany({
    where: {
      id: leadId,
      companyId,
      status: { not: LeadStatus.LOST },
    },
    data: { status: LeadStatus.WON },
  });

  const existing = await prisma.deal.findFirst({
    where: { leadId, companyId },
  });
  if (existing) {
    await prisma.deal.update({
      where: { id: existing.id },
      data: { status: DealStatus.WON, value: dealValue },
    });
  } else {
    await prisma.deal.create({
      data: {
        leadId,
        companyId,
        value: dealValue,
        status: DealStatus.WON,
      },
    });
  }
}
