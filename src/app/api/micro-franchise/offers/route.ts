import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  product: z.enum(["6000", "12000", "ENTERPRISE"]).optional(),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().finite().nonnegative(),
  recurring: z.boolean().optional(),
  instantBonus: z.number().finite().nonnegative().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;
  const rows = await prisma.commissionPlan.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ ok: true as const, offers: rows });
}

export async function POST(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false as const, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false as const, error: "Invalid payload" }, { status: 400 });
  }

  const name = parsed.data.product
    ? `${parsed.data.name.trim()} (${parsed.data.product})`
    : parsed.data.name.trim();
  const row = await prisma.commissionPlan.create({
    data: {
      name,
      type: parsed.data.type,
      value: parsed.data.value,
      recurring: parsed.data.recurring ?? false,
      instantBonus: parsed.data.instantBonus ?? null,
    },
  });
  return NextResponse.json({ ok: true as const, offer: row });
}
