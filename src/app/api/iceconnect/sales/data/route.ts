import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  internalServerErrorResponse,
  prismaKnownErrorResponse,
} from "@/lib/api-response";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { assigneeFilter, isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { serializeLead } from "@/lib/lead-serialize";
import { prisma } from "@/lib/prisma";
import { serializeTask } from "@/lib/task-serialize";

const include = {
  user: { select: { id: true, name: true, email: true } as const },
  lead: { select: { id: true, name: true, status: true, companyId: true } as const },
} as const;

export async function GET(request: NextRequest) {
  const session = requireIceconnectRole(request, [UserRole.TELECALLER]);
  if (session instanceof NextResponse) return session;

  const companyId = session.companyId;
  const leadWhere = {
    companyId,
    ...assigneeFilter(session),
  };

  const taskWhere = isIceconnectPrivileged(session.role)
    ? { lead: { companyId } }
    : { userId: session.sub, lead: { companyId } };

  let leads;
  let tasks;
  try {
    [leads, tasks] = await Promise.all([
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
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 80,
        include,
      }),
    ]);
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    console.error("[GET /api/iceconnect/sales/data]", e);
    return internalServerErrorResponse();
  }

  return NextResponse.json({
    ok: true as const,
    leads: leads.map((l) => ({
      ...serializeLead({
        ...l,
        assignee: l.assignee,
      }),
    })),
    tasks: tasks.map(serializeTask),
  });
}
