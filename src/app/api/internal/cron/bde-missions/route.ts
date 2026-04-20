/**
 * POST /api/internal/cron/bde-missions — create today’s mission + tasks for every BDE.
 * Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from "next/server";
import { createDailyMissionsForAllBdes } from "@/lib/bde-nexa-engine";

export const dynamic = "force-dynamic";

function isAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ ok: false as const, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await createDailyMissionsForAllBdes();
    return NextResponse.json({
      ok: true as const,
      processed: summary.processed,
      new_missions: summary.new_missions,
    });
  } catch (e) {
    console.error("[cron/bde-missions]", e);
    return NextResponse.json(
      { ok: false as const, error: "Cron failed" },
      { status: 500 },
    );
  }
}
