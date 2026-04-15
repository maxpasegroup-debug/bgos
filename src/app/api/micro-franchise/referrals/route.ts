import { NextResponse } from "next/server";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const origin = new URL(request.url).origin;
  const partners = await prisma.microFranchisePartner.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      companies: { select: { id: true, createdAt: true } },
      commissionTransactions: { select: { id: true, amount: true } },
    },
  });

  const items = partners.map((p) => {
    const conversions = p.companies.length;
    const commission = p.commissionTransactions.reduce((sum, t) => sum + t.amount, 0);
    return {
      id: p.id,
      name: p.name,
      referralId: p.phone,
      deepLink: `${origin}/micro-franchise/apply?ref=${encodeURIComponent(p.phone)}`,
      conversions,
      commission: Math.round(commission * 100) / 100,
    };
  });

  return NextResponse.json({ ok: true, items });
}
