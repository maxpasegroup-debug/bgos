import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

export async function GET(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const rows = (await prisma.microFranchisePartner.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      wallet: true,
      companies: {
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
        },
      },
      commissionTransactions: {
        select: { amount: true, status: true },
      },
      application: {
        select: { name: true, location: true, notes: true },
      },
    } as any,
  })) as any[];

  const partners = rows.map((p) => {
    const totalRevenue = p.commissionTransactions.reduce((acc: number, t: any) => acc + t.amount, 0);
    const activeClients = p.companies.filter(
      (c: any) => c.subscriptionStatus === "ACTIVE" || c.subscriptionStatus === "TRIAL",
    ).length;
    return {
      id: p.id,
      businessName: p.application?.name || p.name,
      ownerName: p.name,
      phone: p.phone,
      location: p.application?.location || "",
      tier: p.tier,
      score: p.performanceScore,
      activeClients,
      monthlyRevenue: totalRevenue,
      earnings: p.wallet?.totalEarned ?? 0,
      pending: p.wallet?.pending ?? 0,
      paid: p.wallet?.balance ?? 0,
    };
  });

  return NextResponse.json({ ok: true as const, partners });
}
