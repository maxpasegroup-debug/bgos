import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  BonusConditionType,
  BonusValueType,
  IncentiveAudience,
  IncentiveCampaignLifecycle,
} from "@prisma/client";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    eligibleAudience: z.nativeEnum(IncentiveAudience).optional(),
    conditionType: z.nativeEnum(BonusConditionType).optional(),
    bonusType: z.nativeEnum(BonusValueType).optional(),
    bonusValue: z.number().finite().nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    validMonth: z.string().trim().regex(/^\d{4}-\d{2}$/).optional(),
    poolAmount: z.number().finite().nullable().optional(),
    lifecycle: z.nativeEnum(IncentiveCampaignLifecycle).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;
    const { id } = await ctx.params;
    const parsed = await parseJsonBodyZod(request, patchSchema);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;
    const data: Record<string, unknown> = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.eligibleAudience !== undefined) data.eligibleAudience = d.eligibleAudience;
    if (d.conditionType !== undefined) data.conditionType = d.conditionType;
    if (d.bonusType !== undefined) data.bonusType = d.bonusType;
    if (d.bonusValue !== undefined) data.bonusValue = d.bonusValue;
    if (d.notes !== undefined) data.notes = d.notes;
    if (d.validMonth !== undefined) data.validMonth = d.validMonth;
    if (d.poolAmount !== undefined) data.poolAmount = d.poolAmount;
    if (d.lifecycle !== undefined) data.lifecycle = d.lifecycle;

    const row = await prisma.bonusCampaign.update({ where: { id }, data: data as object });
    return NextResponse.json({ ok: true as const, item: row });
  } catch (e) {
    return handleApiError("PATCH /api/bgos/control/bonuses/[id]", e);
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;
    const { id } = await ctx.params;
    await prisma.bonusCampaign.delete({ where: { id } });
    return NextResponse.json({ ok: true as const });
  } catch (e) {
    return handleApiError("DELETE /api/bgos/control/bonuses/[id]", e);
  }
}
