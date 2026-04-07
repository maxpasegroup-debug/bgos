import { TaskStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { serializeLead } from "@/lib/lead-serialize";
import { prisma } from "@/lib/prisma";
import { serializeTask } from "@/lib/task-serialize";

const include = {
  user: { select: { id: true, name: true, email: true } as const },
  lead: { select: { id: true, name: true, status: true, companyId: true } as const },
} as const;

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.SALES_EXECUTIVE]);
  if (session instanceof NextResponse) return session;

  const companyId = session.companyId;
  /** Sales dashboard: only leads assigned to the current user (no company-wide list here). */
  const leadWhere = {
    companyId,
    assignedTo: session.sub,
  };

  const taskWhere = isIceconnectPrivileged(session.role)
    ? { companyId }
    : { companyId, userId: session.sub };

  const now = new Date();

  let leads;
  let tasks;
  let leadCount: number;
  let pendingTaskCount: number;
  let overdueTaskCount: number;
  try {
    const taskCountBase = { ...taskWhere, status: TaskStatus.PENDING };
    [leads, tasks, leadCount, pendingTaskCount, overdueTaskCount] = await Promise.all([
      prisma.lead.findMany({
        where: leadWhere,
        orderBy: { createdAt: "desc" },
        take: 80,
        include: {
          assignee: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.task.findMany({
        where: taskWhere,
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        take: 80,
        include,
      }),
      prisma.lead.count({ where: leadWhere }),
      prisma.task.count({ where: taskCountBase }),
      prisma.task.count({
        where: {
          ...taskCountBase,
          dueDate: { lt: now },
        },
      }),
    ]);
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/iceconnect/sales/data", e);
  }

  return NextResponse.json({
    ok: true as const,
    stats: {
      leadCount,
      pendingTaskCount,
      overdueTaskCount,
    },
    leads: leads.map((l) => ({
      ...serializeLead({
        ...l,
        assignee: l.assignee,
      }),
    })),
    tasks: tasks.map(serializeTask),
  });
}
