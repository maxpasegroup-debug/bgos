import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { IncentiveAudience, IncentiveCampaignLifecycle } from "@prisma/client";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    audience: z.nativeEnum(IncentiveAudience).optional(),
    eligibilityRules: z.string().trim().min(1).max(8000).optional(),
    prizeDescription: z.string().trim().min(1).max(8000).optional(),
    winnerRule: z.string().trim().min(1).max(4000).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    lifecycle: z.nativeEnum(IncentiveCampaignLifecycle).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireSuperBossApi(request);
    if (session instanceof NextResponse) return session;
    const { id } = await ctx.params;
    const parsed = await parseJsonBodyZod(request, patchSchema);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;
    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.audience !== undefined) data.audience = d.audience;
    if (d.eligibilityRules !== undefined) data.eligibilityRules = d.eligibilityRules;
    if (d.prizeDescription !== undefined) data.prizeDescription = d.prizeDescription;
    if (d.winnerRule !== undefined) data.winnerRule = d.winnerRule;
    if (d.startDate !== undefined) data.startDate = new Date(d.startDate);
    if (d.endDate !== undefined) data.endDate = new Date(d.endDate);
    if (d.lifecycle !== undefined) data.lifecycle = d.lifecycle;

    const row = await prisma.megaPrizeCampaign.update({ where: { id }, data: data as object });
    return NextResponse.json({ ok: true as const, item: row });
  } catch (e) {
    return handleApiError("PATCH /api/bgos/control/mega-prizes/[id]", e);
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireSuperBossApi(request);
    if (session instanceof NextResponse) return session;
    const { id } = await ctx.params;
    await prisma.megaPrizeCampaign.delete({ where: { id } });
    return NextResponse.json({ ok: true as const });
  } catch (e) {
    return handleApiError("DELETE /api/bgos/control/mega-prizes/[id]", e);
  }
}
