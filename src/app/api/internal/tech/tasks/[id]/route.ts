/**
 * PATCH /api/internal/tech/tasks/[id]
 *
 * Updates a task's status. Automatically records timestamps and computes
 * responseTimeMs / completionTimeMs on transitions.
 *
 * Body: { status: "IN_PROGRESS" | "COMPLETED" }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { SalesNetworkRole, TechTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateTechTaskStatus } from "@/lib/internal-tech";

const patchSchema = z.object({
  status: z.nativeEnum(TechTaskStatus),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireAuth(request);
    if (user instanceof NextResponse) return user;

    const session = await requireInternalSalesSession(user);
    if (session instanceof NextResponse) return session;

    const allowed: SalesNetworkRole[] = [SalesNetworkRole.BOSS, SalesNetworkRole.TECH_EXEC];
    if (!allowed.includes(session.salesNetworkRole)) {
      return NextResponse.json(
        { ok: false as const, error: "Only BOSS and TECH_EXEC can update tasks.", code: "FORBIDDEN" as const },
        { status: 403 },
      );
    }

    const parsed = await parseJsonBodyZod(request, patchSchema);
    if (!parsed.ok) return parsed.response;

    const { id } = await params;
    const task = await updateTechTaskStatus(prisma, id, parsed.data.status);

    return NextResponse.json({ ok: true as const, task });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Record to update not found")) {
      return NextResponse.json(
        { ok: false as const, error: "Task not found.", code: "NOT_FOUND" as const },
        { status: 404 },
      );
    }
    logCaughtError("internal-tech-patch", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to update task", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
