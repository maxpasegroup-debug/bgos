/**
 * POST /api/internal/cron/usage-metrics
 *
 * Recalculates {@link UsageMetric} and capacity flags for all non-archived companies.
 * Secured with Authorization: Bearer <CRON_SECRET>.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateUsageMetrics } from "@/lib/usage-metrics-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

  const companies = await prisma.company.findMany({
    where: { archivedAt: null },
    select: { id: true },
    take: 5000,
  });

  let processed = 0;
  let errors = 0;
  for (const c of companies) {
    try {
      await recalculateUsageMetrics(c.id);
      processed++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({
    ok: true as const,
    total: companies.length,
    processed,
    errors,
  });
}
