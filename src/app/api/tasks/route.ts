import { TaskStatus, type Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseTasksQuery } from "@/lib/api-query";
import { prismaKnownErrorResponse, zodValidationErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireAuthWithCompany } from "@/lib/auth";
import { computeTaskOverdue, ensurePendingTasksForOpenLeads } from "@/lib/task-engine";
import { serializeTask } from "@/lib/task-serialize";
import { prisma } from "@/lib/prisma";
import { findUserInCompany } from "@/lib/user-company";

const include = {
  user: { select: { id: true, name: true, email: true } as const },
  lead: { select: { id: true, name: true, status: true, companyId: true } as const },
} as const;

function taskListOrderBy(sort: string | undefined): Prisma.TaskOrderByWithRelationInput[] {
  switch (sort) {
    case "due":
      return [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "desc" }];
    case "created":
      return [{ createdAt: "desc" }];
    case "priority":
    default:
      return [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }];
  }
}

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const companyId = session.companyId;

  const parsedQ = parseTasksQuery(request);
  if (!parsedQ.success) {
    return zodValidationErrorResponse(parsedQ.error);
  }

  const {
    status: statusParam,
    leadId,
    assignedTo,
    overdue,
    sort: sortParam,
    limit: take,
    offset: skip,
  } = parsedQ.data;
  const overdueOnly = overdue === "1" || overdue === "true";

  if (assignedTo && assignedTo !== "me") {
    const member = await findUserInCompany(assignedTo, companyId);
    if (!member) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "User is not part of this company",
          code: "INVALID_ASSIGNEE_FILTER" as const,
        },
        { status: 400 },
      );
    }
  }

  let autoCreatedTasks = 0;
  try {
    autoCreatedTasks = await ensurePendingTasksForOpenLeads(companyId, session.sub);
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/tasks [ensurePendingTasksForOpenLeads]", e);
  }

  const where: Prisma.TaskWhereInput = { companyId };

  if (leadId) where.leadId = leadId;

  if (overdueOnly) {
    where.status = TaskStatus.PENDING;
    where.dueDate = { lt: new Date() };
  } else if (statusParam) {
    where.status = statusParam;
  }

  if (assignedTo === "me") {
    where.userId = session.sub;
  } else if (assignedTo) {
    where.userId = assignedTo;
  }

  const overdueCountWhere: Prisma.TaskWhereInput = {
    ...where,
    status: TaskStatus.PENDING,
    dueDate: { lt: new Date() },
  };

  const orderBy = taskListOrderBy(sortParam);

  let tasks;
  let total: number;
  let overdueTotal: number;
  try {
    [tasks, total, overdueTotal] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy,
        take,
        skip,
        include,
      }),
      prisma.task.count({ where }),
      prisma.task.count({ where: overdueCountWhere }),
    ]);
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/tasks", e);
  }

  const overdueInPage = tasks.filter((t) =>
    computeTaskOverdue({ status: t.status, dueDate: t.dueDate }),
  ).length;

  return NextResponse.json({
    ok: true as const,
    tasks: tasks.map(serializeTask),
    total,
    limit: take,
    offset: skip,
    autoCreatedTasks,
    overdueTotal,
    overdueInPage,
    sort: sortParam ?? "priority",
  });
}
