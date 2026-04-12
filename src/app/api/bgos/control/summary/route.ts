import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

/**
 * Global BGOS metrics (all companies). Super boss only.
 */
export async function GET(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const [totalCompanies, totalLeads, activeUsers] = await Promise.all([
    prisma.company.count(),
    prisma.lead.count(),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  return NextResponse.json({
    ok: true as const,
    metrics: {
      totalCompanies,
      totalLeads,
      /** Reserved for billing / revenue aggregation. */
      totalRevenue: null as number | null,
      activeUsers,
    },
  });
}
