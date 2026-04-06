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

/** Optional counts from `buildBgosDashboardSnapshot` — avoids duplicate queries. */
export type NexaSnapshotInput = {
  pendingFollowUps: number;
  overdueFollowUps: number;
  delays: number;
  opportunities: number;
};

/**
 * Nexa logic — rule-based insights for a company (dashboard / NEXA surfaces).
 */
export async function generateInsights(
  companyId: string,
  nexa?: NexaSnapshotInput,
): Promise<NexaInsight[]> {
  const [leadCount, pendingTasks, wonLeads, lostLeads] = await Promise.all([
    prisma.lead.count({ where: { companyId } }),
    prisma.task.count({
      where: {
        status: TaskStatus.PENDING,
        companyId,
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

  if (nexa) {
    if (nexa.overdueFollowUps > 0) {
      insights.push({
        id: "overdue-follow-ups",
        severity: "alert",
        message: "Overdue follow-ups",
        meta: { overdueFollowUps: nexa.overdueFollowUps },
      });
    }
    if (nexa.delays > 0) {
      insights.push({
        id: "installation-delays",
        severity: "warning",
        message: "Installation delays",
        meta: { delays: nexa.delays },
      });
    }
    if (nexa.opportunities > 0) {
      insights.push({
        id: "opportunities",
        severity: "info",
        message: "Active opportunities",
        meta: { opportunities: nexa.opportunities },
      });
    }
  }

  insights.sort(sortInsights);
  return insights;
}
