import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

/**
 * Competitions + announcements for the internal org (no reliance on active-company cookie).
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const org = await getOrCreateInternalSalesCompanyId();
    if ("error" in org) {
      return NextResponse.json(
        { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
        { status: 500 },
      );
    }

    const companyId = org.companyId;
    const now = new Date();

    const [competitions, announcements] = await Promise.all([
      prisma.nexaCompetition.findMany({
        where: { companyId, endDate: { gte: now } },
        orderBy: { endDate: "asc" },
        take: 20,
        select: {
          id: true,
          title: true,
          reward: true,
          targetMetric: true,
          targetValue: true,
          startDate: true,
          endDate: true,
        },
      }),
      prisma.nexaAnnouncement.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          title: true,
          message: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true as const,
      competitions: competitions.map((c) => ({
        id: c.id,
        title: c.title,
        reward: c.reward,
        target_metric: c.targetMetric,
        target_value: c.targetValue,
        start_date: c.startDate.toISOString(),
        end_date: c.endDate.toISOString(),
      })),
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        created_at: a.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    logCaughtError("GET /api/internal/programs", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load programs", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
