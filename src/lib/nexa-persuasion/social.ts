import { LeadStatus, SalesNetworkRole, type PrismaClient } from "@prisma/client";

/**
 * Rank by totalPoints among sales-network members in the company.
 */
export async function computeSalesRank(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
): Promise<{ rank: number; peerCount: number; leaderPoints: number } | null> {
  const peers = await prisma.userCompany.findMany({
    where: {
      companyId,
      archivedAt: null,
      salesNetworkRole: { in: [SalesNetworkRole.BDE, SalesNetworkRole.BDM, SalesNetworkRole.RSM] },
    },
    orderBy: { totalPoints: "desc" },
    select: { userId: true, totalPoints: true },
  });
  if (peers.length === 0) return null;
  const idx = peers.findIndex((p) => p.userId === userId);
  if (idx < 0) return null;
  const rank = idx + 1;
  const leaderPoints = peers[0]?.totalPoints ?? 0;
  return { rank, peerCount: peers.length, leaderPoints };
}

/**
 * Max wins today (IST day) by any assignee in company — social proof anchor.
 */
export async function maxWinsTodayInCompany(
  prisma: PrismaClient,
  companyId: string,
): Promise<number> {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  const wins = await prisma.lead.groupBy({
    by: ["assignedTo"],
    where: {
      companyId,
      status: LeadStatus.WON,
      updatedAt: { gte: dayStart, lte: dayEnd },
      assignedTo: { not: null },
    },
    _count: { _all: true },
  });
  let max = 0;
  for (const w of wins) {
    if (w._count._all > max) max = w._count._all;
  }
  return max;
}
