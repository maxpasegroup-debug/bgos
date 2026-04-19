import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { getApiCache, setApiCache } from "@/lib/api-runtime-cache";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

/**
 * Global BGOS metrics (all companies). Super boss only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;
    const cacheKey = "control:summary";
    const cached = getApiCache<{
      metrics: { totalCompanies: number; totalLeads: number; totalRevenue: number | null; activeUsers: number };
    }>(cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true as const, metrics: cached.metrics });
    }

    const [totalCompanies, totalLeads, activeUsers] = await Promise.all([
      prisma.company.count(),
      prisma.lead.count(),
      prisma.user.count({ where: { isActive: true } }),
    ]);

    const payload = {
      ok: true as const,
      metrics: {
        totalCompanies,
        totalLeads,
        /** Reserved for billing / revenue aggregation. */
        totalRevenue: null as number | null,
        activeUsers,
      },
    };
    setApiCache(cacheKey, { metrics: payload.metrics });
    return NextResponse.json(payload);
  } catch (e) {
    logCaughtError("GET /api/bgos/control/summary", e);
    return NextResponse.json(
      {
        ok: false as const,
        error: "Could not load summary",
        code: "SERVER_ERROR" as const,
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
