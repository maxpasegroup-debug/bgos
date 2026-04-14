import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().finite().nonnegative(),
  recurring: z.boolean().optional(),
  instantBonus: z.number().finite().nonnegative().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = requireSuperBossApi(request);
    if (session instanceof NextResponse) return session;
    const rows = await prisma.commissionPlan.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ ok: true as const, offers: rows });
  } catch (e) {
    logCaughtError("GET micro-franchise offers", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load offers", code: "SERVER_ERROR" as const },
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

    const row = await prisma.commissionPlan.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        value: parsed.data.value,
        recurring: parsed.data.recurring ?? false,
        instantBonus: parsed.data.instantBonus ?? null,
      },
    });
    return NextResponse.json({ ok: true as const, offer: row });
  } catch (e) {
    logCaughtError("POST micro-franchise offers", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not create offer", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
