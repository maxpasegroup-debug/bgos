import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { deleteApiCacheByPrefix } from "@/lib/api-runtime-cache";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

const bodySchema = z.object({
  companyId: z.string().min(1),
  targetRevenueOneMonth: z.number().min(0),
  targetLeadsOneMonth: z.number().int().min(0),
});

export async function POST(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const parsed = await parseJsonBodyZod(request, bodySchema);
    if (!parsed.ok) return parsed.response;

    const co = await prisma.company.findFirst({
      where: { id: parsed.data.companyId, internalSalesOrg: false },
      select: { id: true },
    });
    if (!co) return jsonError(404, "NOT_FOUND", "Company not found");

    const row = await prisma.companyGrowthPlan.upsert({
      where: { companyId: parsed.data.companyId },
      create: {
        companyId: parsed.data.companyId,
        targetRevenueOneMonth: parsed.data.targetRevenueOneMonth,
        targetLeadsOneMonth: parsed.data.targetLeadsOneMonth,
      },
      update: {
        targetRevenueOneMonth: parsed.data.targetRevenueOneMonth,
        targetLeadsOneMonth: parsed.data.targetLeadsOneMonth,
      },
    });

    deleteApiCacheByPrefix("control:vision");
    return NextResponse.json({
      ok: true as const,
      plan: {
        companyId: row.companyId,
        targetRevenueOneMonth: row.targetRevenueOneMonth,
        targetLeadsOneMonth: row.targetLeadsOneMonth,
      },
    });
  } catch (e) {
    logCaughtError("POST /api/bgos/control/vision/company-target", e);
    return NextResponse.json(
      {
        ok: false as const,
        error: "Could not save company target",
        code: "SERVER_ERROR" as const,
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
