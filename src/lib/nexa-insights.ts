import "server-only";

import { LeadStatus, TaskStatus } from "@prisma/client";
import type { NexaInsight } from "@/types";
import { prisma } from "@/lib/prisma";

const HIGH_INFLOW_LEAD_THRESHOLD = 10;

const MIN_CLOSED_LEADS_FOR_CONVERSION = 4;
const LOW_CONVERSION_WIN_RATE = 0.2;

function sortInsights(a: NexaInsight, b: NexaInsight): number {
  const rank = { alert: 0, warning: 1, info: 2 } as const;
  return rank[a.severity] - rank[b.severity];
}

/**
 * Nexa logic — rule-based insights for a company (dashboard / NEXA surfaces).
 */
export async function generateInsights(companyId: string): Promise<NexaInsight[]> {
  const [leadCount, pendingTasks, wonLeads, lostLeads] = await Promise.all([
    prisma.lead.count({ where: { companyId } }),
    prisma.task.count({
      where: {
        status: TaskStatus.PENDING,
        lead: { companyId },
      },
    }),
    prisma.lead.count({ where: { companyId, status: LeadStatus.WON } }),
    prisma.lead.count({ where: { companyId, status: LeadStatus.LOST } }),
  ]);

  const insights: NexaInsight[] = [];

  if (leadCount > HIGH_INFLOW_LEAD_THRESHOLD) {
    insights.push({
      id: "high-inflow",
      severity: "info",
      message: "High inflow",
      meta: { leads: leadCount },
    });
  }

  if (pendingTasks > 0) {
    insights.push({
      id: "follow-up-needed",
      severity: "warning",
      message: "Follow-up needed",
      meta: { pendingTasks },
    });
  }

  const closedLeads = wonLeads + lostLeads;
  if (closedLeads >= MIN_CLOSED_LEADS_FOR_CONVERSION) {
    const winRate = wonLeads / closedLeads;
    if (winRate < LOW_CONVERSION_WIN_RATE) {
      insights.push({
        id: "low-conversion",
        severity: "alert",
        message: "Low conversion",
        code: "LOW_CONVERSION",
        meta: { wonLeads, lostLeads, winRate: Math.round(winRate * 1000) / 1000 },
      });
    }
  }

  insights.sort(sortInsights);
  return insights;
}
