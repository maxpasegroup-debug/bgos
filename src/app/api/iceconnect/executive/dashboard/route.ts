import {
  IceconnectMetroStage,
  TaskStatus,
  UserRole,
} from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { currentPeriod, eligibleSalaryRupees, monthBoundsUTC } from "@/lib/iceconnect-sales-hub";
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

  const { year: periodYear, month: periodMonth } = currentPeriod();
  const { start, end } = monthBoundsUTC(periodYear, periodMonth);
  const userId = session.sub;
  const companyId = session.companyId;

  try {
    const target = await prisma.salesExecutiveMonthlyTarget.findUnique({
      where: {
        companyId_userId_periodYear_periodMonth: {
          companyId,
          userId,
          periodYear,
          periodMonth,
        },
      },
    });

    const targetCount = target?.targetCount ?? 0;
    const salaryRupees = target?.salaryRupees ?? 0;
    const targetPlan = target?.targetPlan ?? null;

    const achieved =
      target != null && targetCount > 0
        ? await prisma.lead.count({
            where: {
              companyId,
              assignedTo: userId,
              iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
              iceconnectCustomerPlan: target.targetPlan,
              iceconnectSubscribedAt: { gte: start, lte: end },
            },
          })
        : await prisma.lead.count({
            where: {
              companyId,
              assignedTo: userId,
              iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
              iceconnectSubscribedAt: { gte: start, lte: end },
            },
          });

    const { eligible, progressPct } = eligibleSalaryRupees(
      achieved,
      targetCount,
      salaryRupees,
    );

    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const [leadsHandled, demosDone, conversionsMonth, hotFollowUps, tasks] = await Promise.all([
      prisma.lead.count({
        where: {
          companyId,
          assignedTo: userId,
          iceconnectMetroStage: { not: null },
        },
      }),
      prisma.lead.count({
        where: {
          companyId,
          assignedTo: userId,
          iceconnectMetroStage: {
            in: [
              IceconnectMetroStage.DEMO_DONE,
              IceconnectMetroStage.FOLLOW_UP,
              IceconnectMetroStage.ONBOARDING,
              IceconnectMetroStage.PAYMENT_DONE,
              IceconnectMetroStage.SUBSCRIPTION,
            ],
          },
        },
      }),
      prisma.lead.count({
        where: {
          companyId,
          assignedTo: userId,
          iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
          iceconnectSubscribedAt: { gte: start, lte: end },
        },
      }),
      prisma.lead.count({
        where: {
          companyId,
          assignedTo: userId,
          iceconnectMetroStage: {
            in: [IceconnectMetroStage.INTRO_CALL, IceconnectMetroStage.DEMO_DONE, IceconnectMetroStage.FOLLOW_UP],
          },
          nextFollowUpAt: { lte: endOfToday },
        },
      }),
      prisma.task.findMany({
        where: { companyId, userId, status: TaskStatus.PENDING },
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
        take: 12,
        include: { lead: { select: { id: true, name: true } } },
      }),
    ]);
    const pendingFollowUps = tasks.filter((t) => t.dueDate != null);
    const pendingTasks = tasks.filter((t) => t.dueDate == null);

    const remaining = Math.max(0, targetCount - achieved);
    const nexaLines: string[] = [];
    if (targetCount > 0) {
      if (remaining > 0) {
        nexaLines.push(`You need ${remaining} more conversion${remaining === 1 ? "" : "s"} to hit target.`);
      } else {
        nexaLines.push("Target achieved for this month — maintain momentum.");
      }
    } else {
      nexaLines.push("Set a monthly target with your manager to track salary eligibility.");
    }
    if (hotFollowUps > 0) {
      nexaLines.push(`Follow up with ${hotFollowUps} hot lead${hotFollowUps === 1 ? "" : "s"} today.`);
    }
    const readyForClose = await prisma.lead.count({
      where: {
        companyId,
        assignedTo: userId,
        iceconnectMetroStage: IceconnectMetroStage.PAYMENT_DONE,
      },
    });
    if (readyForClose > 0) {
      nexaLines.push(
        `${readyForClose} lead${readyForClose === 1 ? "" : "s"} ready to convert after payment.`,
      );
    }
    if (targetCount > 0 && progressPct < 50 && periodMonth === new Date().getMonth() + 1) {
      const day = new Date().getDate();
      if (day > 10) {
        nexaLines.push("You are behind target — prioritize demos and follow-ups.");
      }
    }

    return NextResponse.json({
      ok: true as const,
      period: { year: periodYear, month: periodMonth },
      target: target
        ? {
            targetCount: target.targetCount,
            targetPlan: target.targetPlan,
            salaryRupees: target.salaryRupees,
          }
        : null,
      achieved,
      progressPct,
      eligibleSalaryRupees: eligible,
      fullSalaryRupees: salaryRupees,
      metrics: {
        leadsHandled,
        demosDone,
        conversions: conversionsMonth,
      },
      nexaLines,
      todayActions: {
        pendingFollowUps: pendingFollowUps.map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate?.toISOString() ?? null,
          lead: t.lead,
        })),
        pendingTasks: pendingTasks.map((t) => ({
          id: t.id,
          title: t.title,
          lead: t.lead,
        })),
      },
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/iceconnect/executive/dashboard", e);
  }
}
