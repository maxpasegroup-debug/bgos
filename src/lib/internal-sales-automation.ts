import "server-only";

import { InternalCallStatus, InternalSalesStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listInternalManagerUserIds, notifyInternalUsers } from "@/lib/internal-sales-notifications";

const TWO_H_MS = 2 * 60 * 60 * 1000;
const TWO_D_MS = 2 * 24 * 60 * 60 * 1000;

export type DelayedLead = { id: string; name: string; createdAt: string };
export type StuckFollowUpLead = { id: string; name: string; updatedAt: string };
export type NoActivityLead = { id: string; name: string; lastContactedAt: string | null };

function openStagesFilter() {
  return {
    internalSalesStage: {
      notIn: [InternalSalesStage.CLIENT_LIVE, InternalSalesStage.CLOSED_LOST],
    },
  };
}

/**
 * Computes automation slices and upserts in-app notifications for managers (deduped).
 */
export async function runInternalSalesAutomation(companyId: string) {
  const now = Date.now();
  const twoHoursAgo = new Date(now - TWO_H_MS);
  const twoDaysAgo = new Date(now - TWO_D_MS);

  const [delayedLeads, stuckFollowUp, noActivityLeads, leadsForSummary] = await Promise.all([
    prisma.lead.findMany({
      where: {
        companyId,
        ...openStagesFilter(),
        internalCallStatus: InternalCallStatus.NOT_CALLED,
        createdAt: { lt: twoHoursAgo },
      },
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.lead.findMany({
      where: {
        companyId,
        internalSalesStage: InternalSalesStage.FOLLOW_UP,
        updatedAt: { lt: twoDaysAgo },
      },
      select: { id: true, name: true, updatedAt: true },
    }),
    prisma.lead.findMany({
      where: {
        companyId,
        ...openStagesFilter(),
        OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: twoDaysAgo } }],
        internalCallStatus: InternalCallStatus.NOT_CALLED,
      },
      select: { id: true, name: true, lastContactedAt: true },
      take: 50,
    }),
    prisma.lead.findMany({
      where: { companyId },
      select: {
        id: true,
        internalSalesStage: true,
        internalCallStatus: true,
        createdAt: true,
        lastContactedAt: true,
      },
    }),
  ]);

  const managerIds = await listInternalManagerUserIds(companyId);
  if (managerIds.length > 0) {
    for (const l of delayedLeads) {
      await notifyInternalUsers({
        companyId,
        userIds: managerIds,
        type: "LEAD_DELAYED",
        title: "Delayed lead",
        body: `${l.name} — not contacted within 2 hours.`,
        dedupeKey: `delayed:${l.id}`,
      });
    }
    for (const l of stuckFollowUp) {
      await notifyInternalUsers({
        companyId,
        userIds: managerIds,
        type: "FOLLOWUP_STUCK",
        title: "Follow-up stuck",
        body: `${l.name} — in follow-up over 2 days.`,
        dedupeKey: `followup-stuck:${l.id}`,
      });
    }
  }

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 86400000);

  let leadsToday = 0;
  let callsToday = 0;
  let demos = 0;
  let won = 0;
  for (const l of leadsForSummary) {
    if (l.createdAt >= startOfDay && l.createdAt < endOfDay) leadsToday += 1;
    if (
      l.lastContactedAt &&
      l.lastContactedAt >= startOfDay &&
      l.lastContactedAt < endOfDay &&
      l.internalCallStatus !== InternalCallStatus.NOT_CALLED
    ) {
      callsToday += 1;
    }
    if (l.internalSalesStage === InternalSalesStage.DEMO_ORIENTATION) demos += 1;
    if (l.internalSalesStage === InternalSalesStage.CLIENT_LIVE) won += 1;
  }
  const open = leadsForSummary.filter(
    (l) =>
      l.internalSalesStage !== InternalSalesStage.CLIENT_LIVE &&
      l.internalSalesStage !== InternalSalesStage.CLOSED_LOST,
  ).length;
  const conversionPct = open + won > 0 ? Math.round((won / (open + won)) * 100) : 0;

  return {
    delayedLeads: delayedLeads.map((l) => ({
      id: l.id,
      name: l.name,
      createdAt: l.createdAt.toISOString(),
    })),
    stuckFollowUp: stuckFollowUp.map((l) => ({
      id: l.id,
      name: l.name,
      updatedAt: l.updatedAt.toISOString(),
    })),
    noActivityLeads: noActivityLeads.map((l) => ({
      id: l.id,
      name: l.name,
      lastContactedAt: l.lastContactedAt?.toISOString() ?? null,
    })),
    dailySummary: {
      leadsToday,
      callsToday,
      conversionsPercent: conversionPct,
    },
  };
}
