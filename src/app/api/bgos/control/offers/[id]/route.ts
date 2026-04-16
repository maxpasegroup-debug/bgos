import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { IncentiveAudience } from "@prisma/client";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(8000).optional(),
    audience: z.nativeEnum(IncentiveAudience).optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    isActive: z.boolean().optional(),
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
    const data: {
      title?: string;
      body?: string;
      audience?: IncentiveAudience;
      startsAt?: Date | null;
      endsAt?: Date | null;
      isActive?: boolean;
    } = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.body !== undefined) data.body = d.body;
    if (d.audience !== undefined) data.audience = d.audience;
    if (d.startsAt !== undefined) data.startsAt = d.startsAt === null ? null : new Date(d.startsAt);
    if (d.endsAt !== undefined) data.endsAt = d.endsAt === null ? null : new Date(d.endsAt);
    if (d.isActive !== undefined) data.isActive = d.isActive;

    const row = await prisma.offerAnnouncement.update({ where: { id }, data });
    return NextResponse.json({ ok: true as const, item: row });
  } catch (e) {
    return handleApiError("PATCH /api/bgos/control/offers/[id]", e);
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
    await prisma.offerAnnouncement.delete({ where: { id } });
    return NextResponse.json({ ok: true as const });
  } catch (e) {
    return handleApiError("DELETE /api/bgos/control/offers/[id]", e);
  }
}
