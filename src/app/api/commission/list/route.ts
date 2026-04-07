import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const commissions = await (prisma as any).commission.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      partner: { select: { id: true, name: true, phone: true } },
      lead: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    ok: true as const,
    commissions: commissions.map((c: any) => ({
      id: c.id,
      partnerId: c.partnerId,
      partnerName: c.partner?.name ?? "Unknown",
      leadId: c.leadId,
      leadName: c.lead?.name ?? "Unknown",
      amount: c.amount,
      type: c.type,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}
