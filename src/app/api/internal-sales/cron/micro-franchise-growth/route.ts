import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { recomputePartnerScoresAndAlerts } from "@/lib/micro-franchise-growth";

/**
 * Scheduled job endpoint for micro-franchise scoring + alerts.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not set" }, { status: 503 });
  }
  if (request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await recomputePartnerScoresAndAlerts();
  return NextResponse.json({ ok: true, ...result });
}
