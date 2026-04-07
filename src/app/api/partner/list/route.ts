import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const partners = await (prisma as any).channelPartner.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      leads: { select: { id: true } },
      commissions: { select: { amount: true, status: true } },
    },
  });

  return NextResponse.json({
    ok: true as const,
    partners: partners.map((p: any) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      leadsGenerated: p.leads.length,
      commissionEarned: p.commissions.reduce((s: number, c: any) => s + Number(c.amount || 0), 0),
      commissionPending: p.commissions.filter((c: any) => c.status === "PENDING").reduce((s: number, c: any) => s + Number(c.amount || 0), 0),
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
