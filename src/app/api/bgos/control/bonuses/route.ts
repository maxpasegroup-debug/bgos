import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  BonusConditionType,
  BonusValueType,
  IncentiveAudience,
  IncentiveCampaignLifecycle,
} from "@prisma/client";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  eligibleAudience: z.nativeEnum(IncentiveAudience),
  conditionType: z.nativeEnum(BonusConditionType),
  bonusType: z.nativeEnum(BonusValueType),
  bonusValue: z.number().finite().optional(),
  notes: z.string().trim().max(4000).optional(),
  validMonth: z.string().trim().regex(/^\d{4}-\d{2}$/),
  poolAmount: z.number().finite().optional(),
  lifecycle: z.nativeEnum(IncentiveCampaignLifecycle).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = requireSuperBossApi(request);
    if (session instanceof NextResponse) return session;
    const items = await prisma.bonusCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json({ ok: true as const, items });
  } catch (e) {
    logCaughtError("GET /api/bgos/control/bonuses", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load bonuses", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireSuperBossApi(request);
    if (session instanceof NextResponse) return session;
    const parsed = await parseJsonBodyZod(request, createSchema);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;
    const row = await prisma.bonusCampaign.create({
      data: {
        title: d.title,
        eligibleAudience: d.eligibleAudience,
        conditionType: d.conditionType,
        bonusType: d.bonusType,
        bonusValue: d.bonusValue ?? null,
        notes: d.notes?.trim() || null,
        validMonth: d.validMonth,
        poolAmount: d.poolAmount ?? null,
        lifecycle: d.lifecycle ?? IncentiveCampaignLifecycle.ACTIVE,
      },
    });
    return NextResponse.json({ ok: true as const, item: row }, { status: 201 });
  } catch (e) {
    return handleApiError("POST /api/bgos/control/bonuses", e);
  }
}
