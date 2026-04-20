import "server-only";

import {
  UsageCapacityNotificationStatus,
  UsageFlagKind,
  UsageFlagStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCompanyLimits } from "@/lib/company-limits";
import { getSalesHierarchyForCompany } from "@/lib/sales-hierarchy";

const THRESHOLD = 0.8;

function ratio(current: number, max: number): number {
  if (max <= 0) return 0;
  return current / max;
}

function isAtOrAboveThreshold(current: number, max: number): boolean {
  return max > 0 && ratio(current, max) >= THRESHOLD;
}

function isBelowThreshold(current: number, max: number): boolean {
  return max <= 0 || ratio(current, max) < THRESHOLD;
}

function kindFromMetric(
  k: UsageFlagKind,
  m: { currentUsers: number; currentLeads: number; currentProjects: number },
  limits: { maxUsers: number; maxLeads: number; maxProjects: number },
): { current: number; max: number } {
  switch (k) {
    case UsageFlagKind.USERS:
      return { current: m.currentUsers, max: limits.maxUsers };
    case UsageFlagKind.LEADS:
      return { current: m.currentLeads, max: limits.maxLeads };
    case UsageFlagKind.PROJECTS:
      return { current: m.currentProjects, max: limits.maxProjects };
    default:
      return { current: 0, max: 0 };
  }
}

async function evaluateAutoResolveFlags(
  companyId: string,
  metric: { currentUsers: number; currentLeads: number; currentProjects: number },
  limits: { maxUsers: number; maxLeads: number; maxProjects: number },
) {
  const open = await prisma.usageFlag.findMany({
    where: {
      companyId,
      status: { in: [UsageFlagStatus.ACTIVE, UsageFlagStatus.IN_PROGRESS] },
    },
  });
  for (const f of open) {
    const { current, max } = kindFromMetric(f.kind, metric, limits);
    if (isBelowThreshold(current, max)) {
      await prisma.usageFlag.update({
        where: { id: f.id },
        data: { status: UsageFlagStatus.CLOSED },
      });
    }
  }
}

async function notifySalesChain(companyId: string, flagId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });
  const { rsmId, bdmId, bdeId } = await getSalesHierarchyForCompany(companyId);
  const name = company?.name ?? "A company";
  const message = `${name} is reaching capacity 🚀\nTime to upgrade or add capacity.`;

  const recipients = [rsmId, bdmId, bdeId].filter((x): x is string => Boolean(x));
  const unique = [...new Set(recipients)];

  for (const userId of unique) {
    await prisma.usageCapacityNotification.create({
      data: {
        companyId,
        userId,
        usageFlagId: flagId,
        message,
        status: UsageCapacityNotificationStatus.UNREAD,
      },
    });
  }
}

async function ensureOpenFlag(
  companyId: string,
  kind: UsageFlagKind,
  metric: { currentUsers: number; currentLeads: number; currentProjects: number },
  limits: { maxUsers: number; maxLeads: number; maxProjects: number },
) {
  const { current, max } = kindFromMetric(kind, metric, limits);
  if (!isAtOrAboveThreshold(current, max)) return;

  const existing = await prisma.usageFlag.findFirst({
    where: {
      companyId,
      kind,
      status: { in: [UsageFlagStatus.ACTIVE, UsageFlagStatus.IN_PROGRESS] },
    },
  });
  if (existing) return;

  const flag = await prisma.usageFlag.create({
    data: {
      companyId,
      kind,
      status: UsageFlagStatus.ACTIVE,
      actionStatus: "pending",
    },
  });
  await notifySalesChain(companyId, flag.id);
}

/**
 * Recompute cached counts and run auto-resolve + high-usage flag creation (80% rule).
 */
export async function recalculateUsageMetrics(companyId: string) {
  const [userCount, leadCount, projectCount] = await Promise.all([
    prisma.userCompany.count({ where: { companyId, archivedAt: null } }),
    prisma.lead.count({ where: { companyId } }),
    prisma.deal.count({ where: { companyId } }),
  ]);

  const metric = await prisma.usageMetric.upsert({
    where: { companyId },
    create: {
      companyId,
      currentUsers: userCount,
      currentLeads: leadCount,
      currentProjects: projectCount,
    },
    update: {
      currentUsers: userCount,
      currentLeads: leadCount,
      currentProjects: projectCount,
    },
  });

  const limitsRow = await ensureCompanyLimits(companyId);
  const limits = {
    maxUsers: limitsRow.maxUsers,
    maxLeads: limitsRow.maxLeads,
    maxProjects: limitsRow.maxProjects,
  };

  await evaluateAutoResolveFlags(companyId, metric, limits);

  await ensureOpenFlag(companyId, UsageFlagKind.USERS, metric, limits);
  await ensureOpenFlag(companyId, UsageFlagKind.LEADS, metric, limits);
  await ensureOpenFlag(companyId, UsageFlagKind.PROJECTS, metric, limits);

  return metric;
}

/**
 * Same as {@link recalculateUsageMetrics} — call after plan upgrade or limit increase.
 */
export async function touchCompanyUsageAfterLimitsOrPlanChange(companyId: string) {
  return recalculateUsageMetrics(companyId);
}

/** Public check helper (uses latest metric + limits). */
export async function checkUsage(companyId: string) {
  return recalculateUsageMetrics(companyId);
}
