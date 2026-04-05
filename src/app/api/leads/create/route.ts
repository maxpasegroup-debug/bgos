import { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { LEAD_ACTIVITY, logLeadActivity } from "@/lib/lead-activity";
import { leadStatusLabel } from "@/lib/lead-pipeline";
import { serializeLead } from "@/lib/lead-serialize";
import { prisma } from "@/lib/prisma";
import { runAutomationExecution } from "@/lib/automation-execution";
import { createLeadTask, dueDateCallLead, taskTitleCallLead } from "@/lib/task-engine";
import { findUserInCompany } from "@/lib/user-company";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(32),
  value: z.number().nonnegative().optional(),
  assignedToUserId: z.string().optional(),
});

export async function POST(request: NextRequest) {
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

  const { name, phone, value, assignedToUserId } = parsed.data;
  const companyId = session.companyId;
  const actorId = session.sub;

  let assigneeId = actorId;
  if (assignedToUserId !== undefined) {
    const assignee = await findUserInCompany(assignedToUserId, companyId);
    if (!assignee) {
      return NextResponse.json(
        { ok: false as const, error: "Assignee not found in your company", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    assigneeId = assignee.id;
  }

  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: {
        name,
        phone,
        value: value ?? null,
        companyId,
        assignedTo: assigneeId,
        status: LeadStatus.NEW,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    await logLeadActivity(tx, {
      companyId,
      userId: actorId,
      type: LEAD_ACTIVITY.CREATED,
      message: `Lead "${name}" created (${phone}) → ${leadStatusLabel(LeadStatus.NEW)}`,
      metadata: {
        leadId: created.id,
        leadName: name,
        phone,
        value: value ?? null,
        status: LeadStatus.NEW,
        assignedTo: assigneeId,
      },
    });

    if (assigneeId !== actorId) {
      await logActivity(tx, {
        companyId,
        userId: actorId,
        type: ACTIVITY_TYPES.LEAD_ASSIGNED,
        message: `Lead "${name}" (${created.id}): assigned to ${created.assignee?.name ?? assigneeId}`,
        metadata: {
          leadId: created.id,
          leadName: name,
          previousAssigneeId: null,
          nextAssigneeId: assigneeId,
        },
      });
    }

    await createLeadTask(tx, {
      title: taskTitleCallLead(created.name),
      userId: assigneeId,
      leadId: created.id,
      companyId,
      dueDate: dueDateCallLead(),
    });

    return created;
  });

  await runAutomationExecution(companyId, "LEAD_CREATED", {
    lead: {
      id: lead.id,
      name: lead.name,
      companyId: lead.companyId,
      assignedTo: lead.assignedTo,
    },
  });

  return NextResponse.json(
    { ok: true as const, lead: serializeLead(lead) },
    { status: 201 },
  );
}
