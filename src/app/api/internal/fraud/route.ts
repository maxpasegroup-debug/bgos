import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { getFraudLogs } from "@/lib/internal-fraud-guard";
import { SalesNetworkRole } from "@prisma/client";

/**
 * GET /api/internal/fraud
 *
 * Returns the fraud audit log for the internal org.
 * Restricted to BOSS only.
 *
 * Query params:
 *   limit  — max rows to return (default 100, max 500)
 */
export async function GET(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  if (session.salesNetworkRole !== SalesNetworkRole.BOSS) {
    return NextResponse.json(
      { ok: false as const, error: "Forbidden — BOSS only.", code: "FORBIDDEN" as const },
      { status: 403 },
    );
  }

  const url   = new URL(request.url);
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10)));

  try {
    const logs = await getFraudLogs(session.companyId, limit);
    return NextResponse.json({ ok: true as const, logs, total: logs.length });
  } catch (e) {
    return handleApiError("GET /api/internal/fraud", e);
  }
}
