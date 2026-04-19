/**
 * Monthly payout cycle cron  —  POST /api/internal/cron/payout-cycle
 *
 * Secured by CRON_SECRET environment variable:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Schedule this endpoint to run once per month (e.g. 1st of month, 02:00 UTC).
 * It is safe to run multiple times — all steps are idempotent within a calendar
 * month.
 *
 * Response is intentionally opaque: counts only, no amounts exposed.
 */

import { NextResponse } from "next/server";
import { runMonthlyPayoutCycle } from "@/lib/internal-payout-cycle";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // allow up to 2 min for large networks

function isAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json(
      { ok: false as const, error: "Unauthorized" },
      { status: 401 },
    );
  }

  // Use end-of-day UTC as the cutoff so earnings that land during the cron run
  // are excluded from this cycle and roll to the next.
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0); // start of today — anything before today is eligible

  try {
    const summary = await runMonthlyPayoutCycle(cutoff);

    return NextResponse.json({
      ok: true as const,
      earningsApproved: summary.earningsApproved,
      walletTxCredited: summary.walletTxCredited,
      earningsPaid: summary.earningsPaid,
      recurring: {
        credited: summary.recurring.credited,
        skippedGrace: summary.recurring.skippedGrace,
        errors: summary.recurring.errors,
      },
      cycleErrors: summary.errors,
    });
  } catch (err) {
    console.error("[cron/payout-cycle] fatal:", err);
    return NextResponse.json(
      { ok: false as const, error: "Payout cycle failed." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true as const,
    endpoint: "payout-cycle-cron",
    status: "ready",
    note: "POST with Authorization: Bearer <CRON_SECRET> to trigger.",
  });
}
