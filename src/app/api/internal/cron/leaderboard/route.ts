/**
 * Daily leaderboard cron  —  POST /api/internal/cron/leaderboard
 *
 * Recalculates global staff ranks from UserCompany.totalPoints and writes
 * to the internal_leaderboard table.
 *
 * Secured by CRON_SECRET environment variable.
 * Invoke daily (e.g. 00:05 UTC) from Vercel Cron / GitHub Actions:
 *
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Returns an opaque summary (total, updated, errors) — no point values.
 */

import { NextResponse } from "next/server";
import { refreshLeaderboard } from "@/lib/internal-leaderboard";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function isAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ ok: false as const, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await refreshLeaderboard();
    return NextResponse.json({
      ok: true as const,
      total: summary.total,
      updated: summary.updated,
      errors: summary.errors,
    });
  } catch (err) {
    console.error("[cron/leaderboard] fatal:", err);
    return NextResponse.json({ ok: false as const, error: "Cron failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true as const, endpoint: "leaderboard-cron", status: "ready" });
}
