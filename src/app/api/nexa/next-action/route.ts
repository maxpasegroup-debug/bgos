import { TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/route-error";

export async function GET(request: Request) {
  const user = await requireAuthWithCompany(request);
  if (user instanceof NextResponse) return user;

  try {
    const [task, delayedInstall, overdueInvoice] = await Promise.all([
      prisma.task.findFirst({
        where: {
          companyId: user.companyId,
          status: TaskStatus.PENDING,
          OR: [{ userId: user.sub }, { userId: null }],
        },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        select: { id: true, title: true, dueDate: true },
      }),
      prisma.installation.findFirst({
        where: {
          companyId: user.companyId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      }),
      prisma.invoice.findFirst({
        where: { companyId: user.companyId, status: { not: "PAID" }, dueDate: { lt: new Date() } },
        select: { id: true },
      }),
    ]);

    let nextAction = "Review daily dashboard and clear top pending items.";
    let badgeCount = 0;
    if (task) {
      badgeCount += 1;
      nextAction = task.title.startsWith("Call")
        ? "Call this lead now."
        : task.title.startsWith("NEXA: Installation delayed")
          ? "Complete site visit escalation."
          : task.title;
    } else if (delayedInstall) {
      badgeCount += 1;
      nextAction = "Complete site visit escalation.";
    } else if (overdueInvoice) {
      badgeCount += 1;
      nextAction = "Follow up on overdue invoice collection.";
    }

    return jsonSuccess({ nextAction, badgeCount });
  } catch (e) {
    return handleApiError("GET /api/nexa/next-action", e);
  }
}
