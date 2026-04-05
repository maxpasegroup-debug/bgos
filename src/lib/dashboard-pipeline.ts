import "server-only";

import { DealStatus, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type PipelineStageRow = { stage: string; count: number };

const STAGES: { label: string; status: LeadStatus | null }[] = [
  { label: "New", status: LeadStatus.NEW },
  { label: "Contacted", status: LeadStatus.CONTACTED },
  { label: "Qualified", status: LeadStatus.QUALIFIED },
  { label: "Visit", status: LeadStatus.VISIT },
  { label: "Proposal", status: LeadStatus.PROPOSAL },
  { label: "Negotiation", status: LeadStatus.NEGOTIATION },
  { label: "Won / Lost", status: null },
];

export async function getPipelineStages(companyId: string): Promise<PipelineStageRow[]> {
  return Promise.all(
    STAGES.map(async ({ label, status }) => {
      if (status === null) {
        const count = await prisma.deal.count({
          where: {
            status: { in: [DealStatus.WON, DealStatus.LOST] },
            lead: { companyId },
          },
        });
        return { stage: label, count };
      }
      const count = await prisma.lead.count({ where: { companyId, status } });
      return { stage: label, count };
    }),
  );
}
