import "server-only";

import { LeadStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseAutomationCenterFromDashboardConfig } from "@/lib/automation-center-config";

const CLOSED_LEAD: LeadStatus[] = [LeadStatus.WON, LeadStatus.LOST];

export type AutomationCenterDashboard = {
  enabled: boolean;
  activeFlows: number;
  followUpsPending: number;
  overdueFollowUps: number;
  nexaSuggestion: string | null;
};

export async function isAutomationCenterEnabled(companyId: string): Promise<boolean> {
  const row = await prisma.company.findUnique({
    where: { id: companyId },
    select: { dashboardConfig: true },
  });
  return parseAutomationCenterFromDashboardConfig(row?.dashboardConfig).enabled;
}

export async function buildAutomationCenterDashboardSlice(
  companyId: string,
  nexa: { pendingFollowUps: number; overdueFollowUps: number },
): Promise<AutomationCenterDashboard> {
  const [row, activeFlows, leadsWithPendingTasks] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { dashboardConfig: true },
    }),
    prisma.automation.count({ where: { companyId } }),
    prisma.lead.count({
      where: {
        companyId,
        status: { notIn: CLOSED_LEAD },
        tasks: { some: { status: TaskStatus.PENDING } },
      },
    }),
  ]);
  const { enabled } = parseAutomationCenterFromDashboardConfig(row?.dashboardConfig);
  const { pendingFollowUps, overdueFollowUps } = nexa;

  let nexaSuggestion: string | null = null;
  if (overdueFollowUps > 0) {
    nexaSuggestion = `${overdueFollowUps} follow-up${overdueFollowUps === 1 ? "" : "s"} overdue`;
  } else if (leadsWithPendingTasks > 0) {
    nexaSuggestion = `${leadsWithPendingTasks} lead${leadsWithPendingTasks === 1 ? "" : "s"} need follow-up`;
  }

  return {
    enabled,
    activeFlows,
    followUpsPending: pendingFollowUps,
    overdueFollowUps,
    nexaSuggestion,
  };
}
