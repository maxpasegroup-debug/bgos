/**
 * GET /api/internal/rewards
 *
 * Returns the caller's reward claims.
 * UNLOCKED claims have value=null (backend-controlled, hidden until reveal).
 * REVEALED/CREDITED claims show the actual value.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { getUserClaims, getUnlockedCount } from "@/lib/internal-rewards";
import { getActiveCompetitions } from "@/lib/internal-rewards";

export async function GET(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  const [claims, unlockedCount, competitions] = await Promise.all([
    getUserClaims(session.userId, 30),
    getUnlockedCount(session.userId),
    getActiveCompetitions(session.userId),
  ]);

  return NextResponse.json({
    ok: true as const,
    unlockedCount,
    claims,
    competitions,
  });
}
