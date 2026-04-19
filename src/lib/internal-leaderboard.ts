/**
 * Internal Competition Leaderboard  (id: bgos_competition_engine_v2)
 *
 * Global ranking of all internal staff by total display-points.
 * One row per user in `internal_leaderboard`, refreshed daily by cron.
 *
 * Design:
 *   · refreshLeaderboard() — writes all rows in a single $transaction;
 *     safe to call concurrently (upsert).
 *   · getLeaderboard()     — one indexed query, LIMIT 50, no joins.
 *   · Dense ranking: users tied on score share the same rank; the next
 *     distinct score takes the next sequential rank.
 *
 * STRICT: no commission values exposed.
 */

import "server-only";

import { SalesNetworkRole, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { POINTS_SCALE } from "@/config/internal-sales-engine";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LeaderboardEntry = {
  userId: string;
  userName: string | null;
  role: SalesNetworkRole | null;
  score: number;   // display points
  rank: number;
};

export type RefreshSummary = {
  total: number;     // staff members processed
  updated: number;   // rows upserted
  errors: number;
};

// ---------------------------------------------------------------------------
// Dense-rank helper
// ---------------------------------------------------------------------------

/**
 * Assigns dense ranks to a sorted (desc) list.
 * Items with equal scores receive the same rank; the next distinct score
 * gets the next rank (not skipping numbers).
 */
function assignDenseRanks<T extends { score: number }>(
  sorted: T[],
): (T & { rank: number })[] {
  let currentRank = 0;
  let prevScore: number | null = null;

  return sorted.map((item) => {
    if (item.score !== prevScore) {
      currentRank += 1;
      prevScore = item.score;
    }
    return { ...item, rank: currentRank };
  });
}

// ---------------------------------------------------------------------------
// refreshLeaderboard — called by daily cron
// ---------------------------------------------------------------------------

export async function refreshLeaderboard(
  prismaClient: PrismaClient = defaultPrisma,
): Promise<RefreshSummary> {
  const orgResult = await getOrCreateInternalSalesCompanyId();
  if ("error" in orgResult) {
    return { total: 0, updated: 0, errors: 1 };
  }
  const { companyId } = orgResult;

  // Fetch all active internal staff with their points + names
  const memberships = await prismaClient.userCompany.findMany({
    where: {
      companyId,
      archivedAt: null,
      salesNetworkRole: {
        in: [
          SalesNetworkRole.BDE,
          SalesNetworkRole.BDM,
          SalesNetworkRole.RSM,
          SalesNetworkRole.BOSS,
        ],
      },
    },
    select: {
      userId: true,
      totalPoints: true,
      salesNetworkRole: true,
      user: { select: { name: true } },
    },
  });

  if (memberships.length === 0) return { total: 0, updated: 0, errors: 0 };

  // Build scored list and sort descending
  const scored = memberships
    .map((m) => ({
      userId: m.userId,
      companyId,
      userName: m.user.name ?? null,
      role: m.salesNetworkRole,
      score: Math.round((m.totalPoints ?? 0) / POINTS_SCALE * 10) / 10,
    }))
    .sort((a, b) => b.score - a.score);

  // Assign dense ranks
  const ranked = assignDenseRanks(scored);

  // Upsert all in a single transaction
  let errors = 0;
  try {
    await prismaClient.$transaction(
      ranked.map((r) =>
        prismaClient.internalLeaderboard.upsert({
          where: { userId: r.userId },
          create: {
            userId: r.userId,
            companyId: r.companyId,
            score: r.score,
            rank: r.rank,
            userName: r.userName,
            role: r.role,
          },
          update: {
            score: r.score,
            rank: r.rank,
            userName: r.userName,
            role: r.role,
          },
        }),
      ),
    );
  } catch {
    errors = 1;
  }

  return { total: memberships.length, updated: errors === 0 ? ranked.length : 0, errors };
}

// ---------------------------------------------------------------------------
// getLeaderboard — single indexed query, default LIMIT 20
// ---------------------------------------------------------------------------

/**
 * Returns ranked leaderboard entries for the given company.
 *
 * Pagination is cursor-based using `afterRank`:
 *   - first page: `afterRank` omitted
 *   - subsequent pages: `afterRank` = highest rank from the previous page
 *
 * Hard cap: max 50 per page (strict performance requirement).
 * Default page size: 20.
 */
export async function getLeaderboard(
  companyId: string,
  limit = 20,
  prismaClient: PrismaClient = defaultPrisma,
  afterRank?: number,
): Promise<LeaderboardEntry[]> {
  const take = Math.min(50, Math.max(1, limit)); // hard cap at 50

  const rows = await prismaClient.internalLeaderboard.findMany({
    where: {
      companyId,
      ...(afterRank !== undefined ? { rank: { gt: afterRank } } : {}),
    },
    orderBy: { rank: "asc" },
    take,
    select: {
      userId:   true,
      userName: true,
      role:     true,
      score:    true,
      rank:     true,
    },
  });
  return rows;
}
