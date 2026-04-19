import type { PrismaClient } from "@prisma/client";
import { consecutiveDayStreak, utcDayString } from "@/lib/nexa-persuasion/dates";

const LOOKBACK_DAYS = 120;

/**
 * Days (UTC) with at least one activity log for this user in this company.
 */
export async function fetchActivityDays(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
): Promise<Set<string>> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - LOOKBACK_DAYS);
  const rows = await prisma.activityLog.findMany({
    where: { companyId, userId, createdAt: { gte: since } },
    select: { createdAt: true },
  });
  const days = new Set<string>();
  for (const r of rows) {
    days.add(utcDayString(r.createdAt));
  }
  return days;
}

/**
 * Days (UTC) with at least one hierarchy subscription start attributed to this user.
 */
export async function fetchSalesDays(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
): Promise<Set<string>> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - LOOKBACK_DAYS);
  const rows = await prisma.salesHierarchySubscription.findMany({
    where: { companyId, ownerUserId: userId, startedAt: { gte: since } },
    select: { startedAt: true },
  });
  const days = new Set<string>();
  for (const r of rows) {
    days.add(utcDayString(r.startedAt));
  }
  return days;
}

export async function computeActivityStreakDays(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
): Promise<number> {
  const days = await fetchActivityDays(prisma, companyId, userId);
  return consecutiveDayStreak(days);
}

export async function computeSalesStreakDays(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
): Promise<number> {
  const days = await fetchSalesDays(prisma, companyId, userId);
  return consecutiveDayStreak(days);
}
