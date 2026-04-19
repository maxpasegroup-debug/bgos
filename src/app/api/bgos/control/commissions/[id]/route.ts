import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { IncentiveCommissionPlanTier } from "@prisma/client";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

const patchSchema = z
  .object({
    planName: z.string().trim().min(1).max(200).optional(),
    planTier: z.nativeEnum(IncentiveCommissionPlanTier).optional(),
    commissionType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
    value: z.number().finite().nonnegative().optional(),
    recurring: z.boolean().optional(),
    instantSaleBonus: z.number().finite().nonnegative().optional(),
    isActive: z.boolean().optional(),
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
    if (d.planName !== undefined) data.planName = d.planName;
    if (d.planTier !== undefined) data.planTier = d.planTier;
    if (d.commissionType !== undefined) data.commissionType = d.commissionType;
    if (d.value !== undefined) data.value = d.value;
    if (d.recurring !== undefined) data.recurring = d.recurring;
    if (d.instantSaleBonus !== undefined) data.instantSaleBonus = d.instantSaleBonus;
    if (d.isActive !== undefined) data.isActive = d.isActive;

    const row = await prisma.commissionRule.update({ where: { id }, data: data as object });
    return NextResponse.json({ ok: true as const, item: row });
  } catch (e) {
    return handleApiError("PATCH /api/bgos/control/commissions/[id]", e);
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
    await prisma.commissionRule.delete({ where: { id } });
    return NextResponse.json({ ok: true as const });
  } catch (e) {
    return handleApiError("DELETE /api/bgos/control/commissions/[id]", e);
  }
}
