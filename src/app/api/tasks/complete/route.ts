import { TaskStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { requireAuth } from "@/lib/auth";
import { serializeTask } from "@/lib/task-serialize";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  taskId: z.string().min(1),
});

const include = {
  user: { select: { id: true, name: true, email: true } as const },
  lead: { select: { id: true, name: true, status: true, companyId: true } as const },
} as const;

export async function PATCH(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const { taskId } = parsed.data;

  const existing = await prisma.task.findFirst({
    where: {
      id: taskId,
      lead: { companyId: session.companyId },
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

  return NextResponse.json({ ok: true as const, task: serializeTask(task) });
}
