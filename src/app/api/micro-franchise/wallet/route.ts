import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

export async function GET(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const rows = await prisma.commissionTransaction.findMany({
    where: { status: { in: ["PENDING", "RELEASED"] } },
    orderBy: { createdAt: "desc" },
    take: 400,
    include: {
      partner: { select: { id: true, name: true, phone: true } },
      company: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({
    ok: true as const,
    transactions: rows.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      partner: t.partner,
      company: t.company,
    })),
  });
}
