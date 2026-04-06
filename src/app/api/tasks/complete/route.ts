import { TaskStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { ensurePendingTaskForLead } from "@/lib/task-engine";
import { serializeTask } from "@/lib/task-serialize";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  taskId: z.string().min(1).max(128),
});

const include = {
  user: { select: { id: true, name: true, email: true } as const },
  lead: { select: { id: true, name: true, status: true, companyId: true } as const },
} as const;

export async function PATCH(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const body = await parseJsonBodyZod(request, bodySchema);
  if (!body.ok) return body.response;

  const { taskId } = body.data;

  try {
    const existing = await prisma.task.findFirst({
      where: {
        id: taskId,
        companyId: session.companyId,
      },
      include,
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false as const, error: "Task not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    if (existing.status === TaskStatus.COMPLETED) {
      return NextResponse.json({ ok: true as const, task: serializeTask(existing) });
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.COMPLETED },
      include,
    });

    await logActivity(prisma, {
      companyId: session.companyId,
      userId: session.sub,
      type: ACTIVITY_TYPES.TASK_COMPLETED,
      message: `Task completed: "${task.title}"`,
      metadata: {
        taskId: task.id,
        title: task.title,
        leadId: task.leadId,
        leadName: task.lead?.name ?? null,
      },
    });

    let replacementCreated = false;
    if (task.leadId) {
      replacementCreated = await ensurePendingTaskForLead(
        session.companyId,
        task.leadId,
        session.sub,
      );
    }

    return NextResponse.json({
      ok: true as const,
      task: serializeTask(task),
      replacementTaskCreated: replacementCreated,
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("PATCH /api/tasks/complete", e);
  }
}
