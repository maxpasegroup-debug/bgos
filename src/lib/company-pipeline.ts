import "server-only";

import { LeadStatus } from "@prisma/client";
import { LEAD_PIPELINE_ORDER } from "@/lib/lead-pipeline";
import { prisma } from "@/lib/prisma";

const LEAD_STATUS_VALUES = new Set<string>(Object.values(LeadStatus));

function isLeadStatus(s: string): s is LeadStatus {
  return LEAD_STATUS_VALUES.has(s);
}

/**
 * Pipeline column order for a company (from dashboard JSON template) or default solar order.
 */
export async function getCompanyPipelineStatuses(companyId: string): Promise<LeadStatus[]> {
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { dashboardConfig: true },
  });
  const raw = c?.dashboardConfig;
  if (!raw || typeof raw !== "object" || raw === null) {
    return [...LEAD_PIPELINE_ORDER];
  }
  const pipeline = (raw as { pipeline?: unknown }).pipeline;
  if (!Array.isArray(pipeline)) {
    return [...LEAD_PIPELINE_ORDER];
  }
  const out: LeadStatus[] = [];
  for (const item of pipeline) {
    if (typeof item === "string" && isLeadStatus(item)) {
      out.push(item);
    }
  }
  return out.length > 0 ? out : [...LEAD_PIPELINE_ORDER];
}
