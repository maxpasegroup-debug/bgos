import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { handleApiError } from "@/lib/route-error";
import { NexaTaskPriority, NexaTaskStatus } from "@prisma/client";

const postSchema = z.object({
  userId: z.string().min(1),
  task: z.string().trim().min(1).max(8000),
  priority: z.nativeEnum(NexaTaskPriority).optional(),
  dueDate: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const org = await getOrCreateInternalSalesCompanyId();
  if ("error" in org) {
    return NextResponse.json(
      { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
      { status: 500 },
    );
  }

  try {
    const tasks = await prisma.nexaTask.findMany({
      where: { companyId: org.companyId },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 80,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return jsonSuccess({
      tasks: tasks.map((t) => ({
        id: t.id,
        userId: t.userId,
        assigneeName: t.user.name,
        task: t.task,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return handleApiError("GET /api/bgos/control/network/nexa-tasks", e);
  }
}

export async function POST(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, postSchema);
  if (!parsed.ok) return parsed.response;

  const org = await getOrCreateInternalSalesCompanyId();
  if ("error" in org) {
    return NextResponse.json(
      { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
      { status: 500 },
    );
  }

  const member = await prisma.userCompany.findFirst({
    where: { companyId: org.companyId, userId: parsed.data.userId },
  });
  if (!member) {
    return jsonError(400, "VALIDATION_ERROR", "User is not in this workspace.");
  }

  try {
    const due = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    const row = await prisma.nexaTask.create({
      data: {
        companyId: org.companyId,
        userId: parsed.data.userId,
        task: parsed.data.task,
        priority: parsed.data.priority ?? NexaTaskPriority.MEDIUM,
        dueDate: due,
        status: NexaTaskStatus.PENDING,
      },
    });
    return jsonSuccess({
      task: {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return handleApiError("POST /api/bgos/control/network/nexa-tasks", e);
  }
}
