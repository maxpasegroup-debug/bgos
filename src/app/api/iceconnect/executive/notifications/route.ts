import { IceconnectMetroStage, TaskStatus, UserRole } from "@prisma/client";
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

  const { year, month } = currentPeriod();
  const { start, end } = monthBoundsUTC(year, month);
  const now = new Date();

  try {
    const items: { id: string; text: string; kind: string; at: string }[] = [];

    const since = new Date(now.getTime() - 48 * 3600 * 1000);
    const newAssigned = await prisma.lead.count({
      where: {
        companyId: session.companyId,
        assignedTo: session.sub,
        createdAt: { gte: since },
        iceconnectMetroStage: IceconnectMetroStage.LEAD_CREATED,
      },
    });
    if (newAssigned > 0) {
      items.push({
        id: "new-leads",
        text: `${newAssigned} new lead${newAssigned === 1 ? "" : "s"} in the last 48h`,
        kind: "lead",
        at: now.toISOString(),
      });
    }

    const overdueTasks = await prisma.task.count({
      where: {
        companyId: session.companyId,
        userId: session.sub,
        status: TaskStatus.PENDING,
        dueDate: { lt: now },
      },
    });
    if (overdueTasks > 0) {
      items.push({
        id: "overdue-tasks",
        text: `${overdueTasks} follow-up reminder${overdueTasks === 1 ? "" : "s"} overdue`,
        kind: "followup",
        at: now.toISOString(),
      });
    }

    const target = await prisma.salesExecutiveMonthlyTarget.findUnique({
      where: {
        companyId_userId_periodYear_periodMonth: {
          companyId: session.companyId,
          userId: session.sub,
          periodYear: year,
          periodMonth: month,
        },
      },
    });

    if (target && target.targetCount > 0) {
      const achieved = await prisma.lead.count({
        where: {
          companyId: session.companyId,
          assignedTo: session.sub,
          iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
          iceconnectCustomerPlan: target.targetPlan,
          iceconnectSubscribedAt: { gte: start, lte: end },
        },
      });
      const { progressPct } = eligibleSalaryRupees(
        achieved,
        target.targetCount,
        target.salaryRupees,
      );
      if (progressPct < 40 && now.getDate() > 7) {
        items.push({
          id: "target-alert",
          text: `Target alert: ${progressPct}% of monthly goal — accelerate demos and follow-ups`,
          kind: "target",
          at: now.toISOString(),
        });
      }
    }

    const paymentDone = await prisma.lead.count({
      where: {
        companyId: session.companyId,
        assignedTo: session.sub,
        iceconnectMetroStage: IceconnectMetroStage.PAYMENT_DONE,
      },
    });
    if (paymentDone > 0) {
      items.push({
        id: "nexa-close",
        text: `Nexa: ${paymentDone} lead${paymentDone === 1 ? "" : "s"} ready to convert to customer`,
        kind: "nexa",
        at: now.toISOString(),
      });
    }

    return NextResponse.json({ ok: true as const, notifications: items });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/iceconnect/executive/notifications", e);
  }
}
