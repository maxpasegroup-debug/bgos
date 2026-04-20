import "server-only";

import { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SolarNexaInsight = { id: string; type: "suggestion" | "alert"; text: string };

/**
 * Lightweight Nexa layer: rules for new leads, stalled deals, and delays (display on dashboard).
 * Full automation hooks can enqueue tasks / notifications from these signals later.
 */
export async function getSolarBossNexaInsights(companyId: string): Promise<SolarNexaInsight[]> {
  const out: SolarNexaInsight[] = [];
  let nid = 0;

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 864e5);

  const [newLeads, staleLeads, pendingInstalls] = await Promise.all([
    prisma.lead.count({
      where: { companyId, createdAt: { gte: dayAgo } },
    }),
    prisma.lead.count({
      where: {
        companyId,
        updatedAt: { lt: dayAgo },
        status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
      },
    }),
    prisma.installation.count({
      where: { companyId, completedAt: null },
    }).catch(() => 0),
  ]);

  if (newLeads > 0) {
    out.push({
      id: `n-${++nid}`,
      type: "suggestion",
      text: `${newLeads} new lead(s) in 24h — Nexa can schedule site visits when you connect the pipeline.`,
    });
  }
  if (staleLeads > 0) {
    out.push({
      id: `n-${++nid}`,
      type: "alert",
      text: `${staleLeads} lead(s) quiet for 24h+ — run follow-ups or move stage.`,
    });
  }
  if (pendingInstalls > 0) {
    out.push({
      id: `n-${++nid}`,
      type: "alert",
      text: `${pendingInstalls} installation(s) pending — align crew and customer slots.`,
    });
  }

  if (out.length === 0) {
    out.push({
      id: "n-default",
      type: "suggestion",
      text: "Nexa: pipeline is calm — good time to refresh your pipeline targets.",
    });
  }

  return out.slice(0, 5);
}
