import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";

/**
 * Tenant-scoped Nexa work board tasks (active company).
 * Internal platform uses {@link /api/internal/network/nexa-tasks}.
 */
export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  try {
    const tasks = await prisma.nexaTask.findMany({
      where: { companyId: session.companyId },
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
    return handleApiError("GET /api/company/nexa-tasks", e);
  }
}
