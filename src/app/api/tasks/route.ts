import { TaskStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseTasksQuery } from "@/lib/api-query";
import {
  internalServerErrorResponse,
  prismaKnownErrorResponse,
  zodValidationErrorResponse,
} from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { ensurePendingTasksForOpenLeads } from "@/lib/task-engine";
import { serializeTask } from "@/lib/task-serialize";
import { prisma } from "@/lib/prisma";

const include = {
  user: { select: { id: true, name: true, email: true } as const },
  lead: { select: { id: true, name: true, status: true, companyId: true } as const },
} as const;

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
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
    limit: take,
    offset: skip,
  } = parsedQ.data;
  const overdueOnly = overdue === "1" || overdue === "true";

  let autoCreatedTasks = 0;
  try {
    autoCreatedTasks = await ensurePendingTasksForOpenLeads(companyId, session.sub);
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return internalServerErrorResponse();
  }

  const where: {
    lead: { companyId: string; id?: string };
    status?: TaskStatus;
    userId?: string;
    dueDate?: { lt: Date };
  } = { lead: { companyId } };

  if (leadId) where.lead.id = leadId;

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

  let tasks;
  let total: number;
  try {
    [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take,
        skip,
        include,
      }),
      prisma.task.count({ where }),
    ]);
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return internalServerErrorResponse();
  }

  return NextResponse.json({
    ok: true as const,
    tasks: tasks.map(serializeTask),
    total,
    limit: take,
    offset: skip,
    autoCreatedTasks,
  });
}
