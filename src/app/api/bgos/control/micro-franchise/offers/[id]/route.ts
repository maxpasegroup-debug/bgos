import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  value: z.number().finite().nonnegative().optional(),
  recurring: z.boolean().optional(),
  instantBonus: z.number().finite().nonnegative().nullable().optional(),
});

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

    const row = await prisma.commissionPlan.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ ok: true as const, offer: row });
  } catch (e) {
    logCaughtError("PATCH micro-franchise offer", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not update offer", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
