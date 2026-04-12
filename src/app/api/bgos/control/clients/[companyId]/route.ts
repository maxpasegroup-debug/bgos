import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { bossControlClientCategory } from "@/lib/bgos-control-client-category";

const SALES_ROLES: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.SALES_HEAD,
  UserRole.TELECALLER,
  UserRole.MANAGER,
];

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;
  const { companyId } = await ctx.params;

  const company = await prisma.company.findFirst({
    where: { id: companyId, internalSalesOrg: false },
    select: {
      id: true,
      name: true,
      plan: true,
      subscriptionStatus: true,
      isTrialActive: true,
      internalSalesOrg: true,
      trialEndDate: true,
      subscriptionPeriodEnd: true,
      owner: { select: { id: true, name: true, email: true, mobile: true } },
    },
  });

  if (!company) {
    return NextResponse.json(
      { ok: false as const, error: "Company not found", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }

  const category = bossControlClientCategory(company);
  const [billing, salesMemberships, activities] = await Promise.all([
    prisma.razorpayPayment.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        plan: true,
        createdAt: true,
      },
    }),
    prisma.userCompany.findMany({
      where: { companyId, jobRole: { in: SALES_ROLES } },
      take: 8,
      select: {
        jobRole: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.activityLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        type: true,
        message: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  const salesExecutive =
    salesMemberships.find((m) => m.jobRole === UserRole.SALES_EXECUTIVE) ??
    salesMemberships[0] ??
    null;

  return NextResponse.json({
    ok: true as const,
    company: {
      id: company.id,
      name: company.name,
      plan: company.plan,
      subscriptionStatus: company.subscriptionStatus,
      isTrialActive: company.isTrialActive,
      category: category ?? "BASIC",
      trialEndDate: company.trialEndDate?.toISOString() ?? null,
      subscriptionPeriodEnd: company.subscriptionPeriodEnd?.toISOString() ?? null,
    },
    boss: company.owner
      ? {
          id: company.owner.id,
          name: company.owner.name,
          email: company.owner.email,
          mobile: company.owner.mobile,
        }
      : null,
    billingHistory: billing.map((b) => ({
      id: b.id,
      amount: b.amount,
      currency: b.currency,
      status: b.status,
      plan: b.plan,
      createdAt: b.createdAt.toISOString(),
    })),
    assignedSalesExecutive: salesExecutive
      ? {
          name: salesExecutive.user.name,
          email: salesExecutive.user.email,
          jobRole: salesExecutive.jobRole,
        }
      : null,
    activityTimeline: activities.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
      actorName: a.user?.name ?? a.user?.email ?? null,
    })),
  });
}
