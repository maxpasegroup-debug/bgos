import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { runInternalSalesAutomation } from "@/lib/internal-sales-automation";

/**
 * Optional scheduled job: POST with header `x-cron-secret: ${CRON_SECRET}`.
 * Runs automation + manager notifications for the internal sales company.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not set" }, { status: 503 });
  }
  if (request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await getOrCreateInternalSalesCompanyId();
  if ("error" in resolved) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 503 });
  }

  const result = await runInternalSalesAutomation(resolved.companyId);
  return NextResponse.json({ ok: true, ...result });
}
