import "server-only";

import { LeadStatus } from "@prisma/client";
import { getCompanyPipelineStatuses } from "@/lib/company-pipeline";
import { leadStatusLabel } from "@/lib/lead-pipeline";
import { prisma } from "@/lib/prisma";

export type PipelineStageRow = { stage: string; count: number };

export async function getPipelineStages(companyId: string): Promise<PipelineStageRow[]> {
  const order = await getCompanyPipelineStatuses(companyId);
  const grouped = await prisma.lead.groupBy({
    by: ["status"],
    where: { companyId },
    _count: { _all: true },
  });
  const counts = new Map<LeadStatus, number>(
    grouped.map((g) => [g.status, g._count._all]),
  );
  return order.map((status) => ({
    stage: leadStatusLabel(status),
    count: counts.get(status) ?? 0,
  }));
}
