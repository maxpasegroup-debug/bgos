import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { IncentiveCommissionPlanTier } from "@prisma/client";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

const createSchema = z.object({
  planName: z.string().trim().min(1).max(200),
  planTier: z.nativeEnum(IncentiveCommissionPlanTier),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().finite().nonnegative(),
  recurring: z.boolean().optional(),
  instantSaleBonus: z.number().finite().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;
    const items = await prisma.commissionRule.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json({ ok: true as const, items });
  } catch (e) {
    logCaughtError("GET /api/bgos/control/commissions", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load commission rules", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;
    const parsed = await parseJsonBodyZod(request, createSchema);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;
    const row = await prisma.commissionRule.create({
      data: {
        planName: d.planName,
        planTier: d.planTier,
        commissionType: d.commissionType,
        value: d.value,
        recurring: d.recurring ?? true,
        instantSaleBonus: d.instantSaleBonus ?? 0,
        isActive: d.isActive ?? true,
      },
    });
    return NextResponse.json({ ok: true as const, item: row }, { status: 201 });
  } catch (e) {
    return handleApiError("POST /api/bgos/control/commissions", e);
  }
}
