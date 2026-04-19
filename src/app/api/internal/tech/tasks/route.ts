/**
 * GET  /api/internal/tech/tasks  — list all tasks (BOSS/TECH_EXEC sees all;
 *                                  others see only their assigned tasks)
 * POST /api/internal/tech/tasks  — create a new task (BOSS / TECH_EXEC)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { SalesNetworkRole, TechTaskPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createTechTask, listTechTasks, getTechStats } from "@/lib/internal-tech";

const createSchema = z.object({
  company:     z.string().min(1).max(200),
  requestType: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priority:    z.nativeEnum(TechTaskPriority).default(TechTaskPriority.MEDIUM),
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const user = requireAuth(request);
    if (user instanceof NextResponse) return user;

    const session = await requireInternalSalesSession(user);
    if (session instanceof NextResponse) return session;

    const isBoss     = session.salesNetworkRole === SalesNetworkRole.BOSS;
    const isTechExec = session.salesNetworkRole === SalesNetworkRole.TECH_EXEC;

    // BOSS + TECH_EXEC see all tasks; others see only their assigned tasks
    const filters = isBoss || isTechExec
      ? {}
      : { assignedTo: session.userId };

    const [tasks, stats] = await Promise.all([
      listTechTasks(prisma, filters),
      (isBoss || isTechExec) ? getTechStats(prisma) : Promise.resolve(null),
    ]);

    return NextResponse.json({ ok: true as const, tasks, stats });
  } catch (e) {
    logCaughtError("internal-tech-list", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to load tasks", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const user = requireAuth(request);
    if (user instanceof NextResponse) return user;

    const session = await requireInternalSalesSession(user);
    if (session instanceof NextResponse) return session;

    const allowed: SalesNetworkRole[] = [SalesNetworkRole.BOSS, SalesNetworkRole.TECH_EXEC];
    if (!allowed.includes(session.salesNetworkRole)) {
      return NextResponse.json(
        { ok: false as const, error: "Only BOSS and TECH_EXEC can create tasks.", code: "FORBIDDEN" as const },
        { status: 403 },
      );
    }

    const parsed = await parseJsonBodyZod(request, createSchema);
    if (!parsed.ok) return parsed.response;

    const task = await createTechTask(prisma, {
      company:     parsed.data.company,
      requestType: parsed.data.requestType,
      description: parsed.data.description,
      priority:    parsed.data.priority,
      createdById: session.userId,
    });

    return NextResponse.json({ ok: true as const, task }, { status: 201 });
  } catch (e) {
    logCaughtError("internal-tech-create", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to create task", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
