/**
 * GET /api/internal/leaderboard
 *
 * Returns the internal staff leaderboard (paginated, default 20 per page).
 * Cursor-based pagination via `afterRank`.
 *
 * Query params:
 *   limit      — page size (default 20, max 50)
 *   afterRank  — cursor: return entries with rank > afterRank (for next page)
 *
 * Response:
 *   { ok, entries, myRank, myScore, total, hasMore, nextCursor }
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { prisma } from "@/lib/prisma";
import { getLeaderboard } from "@/lib/internal-leaderboard";

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    if (user instanceof NextResponse) return user;

    const session = await requireInternalSalesSession(user);
    if (session instanceof NextResponse) return session;

    const sp        = request.nextUrl.searchParams;
    const limit     = Math.min(50, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
    const afterRank = sp.has("afterRank")
      ? Math.max(0, parseInt(sp.get("afterRank")!, 10) || 0)
      : undefined;

    const entries = await getLeaderboard(session.companyId, limit, prisma, afterRank);

    // Total ranked entries in this company (used for hasMore)
    const totalRanked = await prisma.internalLeaderboard.count({
      where: { companyId: session.companyId },
    });

    const lastEntry  = entries[entries.length - 1];
    const nextCursor = entries.length === limit ? (lastEntry?.rank ?? null) : null;
    const hasMore    = nextCursor !== null;

    // Caller's own rank/score (may not be in current page)
    const mine = entries.find((e) => e.userId === session.userId);
    let myRank:  number | null = mine?.rank  ?? null;
    let myScore: number | null = mine?.score ?? null;

    if (!mine) {
      const myRow = await prisma.internalLeaderboard.findUnique({
        where:  { userId: session.userId },
        select: { rank: true, score: true },
      });
      myRank  = myRow?.rank  ?? null;
      myScore = myRow?.score ?? null;
    }

    return NextResponse.json({
      ok:         true as const,
      entries,
      total:      totalRanked,
      limit,
      afterRank:  afterRank ?? null,
      hasMore,
      nextCursor,
      myRank,
      myScore,
    });
  } catch (e) {
    logCaughtError("internal-leaderboard", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to load leaderboard", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
