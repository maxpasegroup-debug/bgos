import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { CompanySubscriptionStatus, UserRole } from "@prisma/client";
import { logCaughtError } from "@/lib/api-response";
import { requireActiveCompanyMembership } from "@/lib/auth";
import { countPartnerActiveCustomers } from "@/lib/micro-franchise-commission";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireActiveCompanyMembership(request);
    if (session instanceof NextResponse) return session;
    if (session.role !== UserRole.MICRO_FRANCHISE) {
      return NextResponse.json({ ok: false as const, error: "Forbidden", code: "FORBIDDEN" as const }, { status: 403 });
    }

    const partner = await prisma.microFranchisePartner.findUnique({
      where: { userId: session.sub },
      include: {
        wallet: true,
        commissionPlan: true,
        companies: {
          select: {
            id: true,
            name: true,
            subscriptionStatus: true,
            plan: true,
            createdAt: true,
          },
        },
        commissionTransactions: {
          orderBy: { createdAt: "desc" },
          take: 80,
          include: { company: { select: { name: true, plan: true } } },
        },
      },
    });
    if (!partner || !partner.wallet) {
      return NextResponse.json({ ok: false as const, error: "Partner not found", code: "NOT_FOUND" as const }, {
        status: 404,
      });
    }

    const offersCatalog = await prisma.commissionPlan.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        value: true,
        recurring: true,
        instantBonus: true,
      },
    });

    const totalReferrals = partner.companies.length;
    const activeCustomers = await countPartnerActiveCustomers(partner.id);
    const conversions = partner.companies.filter(
      (c) =>
        c.subscriptionStatus === CompanySubscriptionStatus.ACTIVE ||
        c.subscriptionStatus === CompanySubscriptionStatus.PAYMENT_PENDING,
    ).length;

    return NextResponse.json({
      ok: true as const,
      partner: {
        id: partner.id,
        name: partner.name,
        phone: partner.phone,
        email: partner.email,
        referralId: partner.phone,
        plan: partner.commissionPlan,
        wallet: partner.wallet,
        totalReferrals,
        activeCustomers,
        conversions,
        companies: partner.companies,
        history: partner.commissionTransactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          type: t.type,
          status: t.status,
          companyName: t.company.name,
          companyPlan: t.company.plan,
          createdAt: t.createdAt.toISOString(),
        })),
        offersCatalog,
      },
    });
  } catch (e) {
    logCaughtError("GET /api/micro-franchise/partner/me", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load partner", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
