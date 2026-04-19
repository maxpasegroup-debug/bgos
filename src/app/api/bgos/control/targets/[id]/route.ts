import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  TargetAssignScope,
  TargetDurationPreset,
  TargetMetricType,
  TargetRoleCategory,
} from "@prisma/client";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    roleCategory: z.nativeEnum(TargetRoleCategory).optional(),
    durationPreset: z.nativeEnum(TargetDurationPreset).optional(),
    metricType: z.nativeEnum(TargetMetricType).optional(),
    targetNumber: z.number().finite().nonnegative().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    assignScope: z.nativeEnum(TargetAssignScope).optional(),
    assigneeUserId: z.string().trim().nullable().optional(),
    departmentLabel: z.string().trim().max(120).nullable().optional(),
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
    const data: {
      title?: string;
      roleCategory?: TargetRoleCategory;
      durationPreset?: TargetDurationPreset;
      metricType?: TargetMetricType;
      targetNumber?: number;
      startDate?: Date;
      endDate?: Date;
      assignScope?: TargetAssignScope;
      assigneeUserId?: string | null;
      departmentLabel?: string | null;
    } = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.roleCategory !== undefined) data.roleCategory = d.roleCategory;
    if (d.durationPreset !== undefined) data.durationPreset = d.durationPreset;
    if (d.metricType !== undefined) data.metricType = d.metricType;
    if (d.targetNumber !== undefined) data.targetNumber = d.targetNumber;
    if (d.startDate !== undefined) data.startDate = new Date(d.startDate);
    if (d.endDate !== undefined) data.endDate = new Date(d.endDate);
    if (d.assignScope !== undefined) data.assignScope = d.assignScope;
    if (d.assigneeUserId !== undefined) data.assigneeUserId = d.assigneeUserId?.trim() || null;
    if (d.departmentLabel !== undefined) data.departmentLabel = d.departmentLabel?.trim() || null;

    const row = await prisma.targetCampaign.update({
      where: { id },
      data,
    });
    return NextResponse.json({ ok: true as const, item: row });
  } catch (e) {
    return handleApiError("PATCH /api/bgos/control/targets/[id]", e);
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
    await prisma.targetCampaign.delete({ where: { id } });
    return NextResponse.json({ ok: true as const });
  } catch (e) {
    return handleApiError("DELETE /api/bgos/control/targets/[id]", e);
  }
}
