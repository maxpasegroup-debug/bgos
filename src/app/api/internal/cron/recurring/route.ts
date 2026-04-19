/**
 * Daily recurring cron endpoint  —  POST /api/internal/cron/recurring
 *
 * Secured by the CRON_SECRET environment variable.
 * Invoke from a scheduler (Vercel Cron, GitHub Actions, etc.) with:
 *
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Returns a summary (processed, credited, totalCredited, skippedGrace, errors).
 * NO commission breakdown, slab rates, or tier thresholds are exposed.
 */

import { NextResponse } from "next/server";
import { runDailyRecurringCron } from "@/lib/internal-recurring";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds — allow time for large networks

function isAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Guard: if env var is missing, block all calls to prevent accidental exposure
    return false;
  }
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json(
      { ok: false as const, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const summary = await runDailyRecurringCron();

    return NextResponse.json({
      ok: true as const,
      processed: summary.processed,
      credited: summary.credited,
      skippedGrace: summary.skippedGrace,
      errors: summary.errors,
      // totalCredited is intentionally omitted from the response
      // to avoid leaking commission aggregates externally.
    });
  } catch (err) {
    console.error("[cron/recurring] fatal error:", err);
    return NextResponse.json(
      { ok: false as const, error: "Cron run failed." },
      { status: 500 },
    );
  }
}

// GET: health-check (no auth required, returns no sensitive data)
export async function GET() {
  return NextResponse.json({ ok: true as const, endpoint: "recurring-cron", status: "ready" });
}
