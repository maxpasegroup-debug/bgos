import { IceconnectMetroStage, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import {
  currentPeriod,
  eligibleSalaryRupees,
  monthBoundsUTC,
} from "@/lib/iceconnect-sales-hub";
import { prisma } from "@/lib/prisma";
import { assertIceconnectInternalSalesOrg } from "@/lib/require-iceconnect-internal-org";

const ROLES: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.MANAGER,
  UserRole.TECH_HEAD,
  UserRole.TECH_EXECUTIVE,
];

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;

  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const { year: y, month: m } = currentPeriod();
  const { start, end } = monthBoundsUTC(y, m);

  try {
    const target = await prisma.salesExecutiveMonthlyTarget.findUnique({
      where: {
        companyId_userId_periodYear_periodMonth: {
          companyId: session.companyId,
          userId: session.sub,
          periodYear: y,
          periodMonth: m,
        },
      },
    });

    const targetCount = target?.targetCount ?? 0;
    const salaryRupees = target?.salaryRupees ?? 0;

    const achievedThisMonth =
      target != null && targetCount > 0
        ? await prisma.lead.count({
            where: {
              companyId: session.companyId,
              assignedTo: session.sub,
              iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
              iceconnectCustomerPlan: target.targetPlan,
              iceconnectSubscribedAt: { gte: start, lte: end },
            },
          })
        : await prisma.lead.count({
            where: {
              companyId: session.companyId,
              assignedTo: session.sub,
              iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
              iceconnectSubscribedAt: { gte: start, lte: end },
            },
          });

    const { eligible } = eligibleSalaryRupees(achievedThisMonth, targetCount, salaryRupees);

    const totalSubscriptions = await prisma.lead.count({
      where: {
        companyId: session.companyId,
        assignedTo: session.sub,
        iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
      },
    });

    const perSaleRupees =
      targetCount > 0 && salaryRupees > 0 ? Math.round(salaryRupees / targetCount) : 0;

    /** Simple lifetime proxy: conversions × per-sale at full target (informational). */
    const totalEarningsProxy = perSaleRupees * totalSubscriptions;

    return NextResponse.json({
      ok: true as const,
      monthlyEarningsEligible: eligible,
      monthlySalaryFull: salaryRupees,
      perSaleAtFullTarget: perSaleRupees,
      totalConversions: totalSubscriptions,
      totalEarningsEstimate: totalEarningsProxy,
      period: { year: y, month: m },
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/iceconnect/executive/wallet", e);
  }
}
