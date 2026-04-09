import { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { requireAuthWithCompany } from "@/lib/auth";
import { applyLeadPipelineUpdate } from "@/lib/lead-status-service";
import { leadStatusLabel } from "@/lib/lead-pipeline";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  assignedToUserId: z.union([z.string().min(1), z.null()]).optional(),
  notes: z.string().max(6000).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

function hasLeadId(meta: unknown, leadId: string): boolean {
  if (!meta || typeof meta !== "object") return false;
  const row = meta as Record<string, unknown>;
  return row.leadId === leadId;
}

export async function GET(request: NextRequest, context: Ctx) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  const { id } = await context.params;

  const [lead, activities] = await Promise.all([
    prisma.lead.findFirst({
      where: { id, companyId: session.companyId },
      include: {
        assignee: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    }),
    prisma.activityLog.findMany({
      where: { companyId: session.companyId },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        id: true,
        type: true,
        message: true,
        metadata: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    }),
  ]);

  if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");

  const leadActivity = activities
    .filter((a) => hasLeadId(a.metadata, id))
    .slice(0, 20)
    .map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
      user: a.user,
    }));

  return jsonSuccess({
    lead: {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      stage: lead.status,
      stageLabel: leadStatusLabel(lead.status),
      assignedToUserId: lead.assignedTo,
      assignedToName: lead.assignee?.name ?? null,
      createdByUserId: lead.createdByUserId,
      createdByName: lead.creator?.name ?? null,
      dealValue: lead.value ?? null,
      notes: lead.siteReport ?? "",
      updatedAt: lead.updatedAt.toISOString(),
    },
    activity: leadActivity,
  });
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  const { id } = await context.params;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const { status, assignedToUserId, notes } = parsed.data;
  if (status === undefined && assignedToUserId === undefined && notes === undefined) {
    return jsonError(400, "VALIDATION_ERROR", "Nothing to update");
  }

  if (status !== undefined || assignedToUserId !== undefined) {
    const result = await applyLeadPipelineUpdate({
      actorId: session.sub,
      companyId: session.companyId,
      leadId: id,
      ...(status !== undefined ? { nextStatus: status } : {}),
      ...(assignedToUserId !== undefined ? { assignedToUserId } : {}),
    });
    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }
  }

  if (notes !== undefined) {
    const trimmed = notes.trim();
    const row = await prisma.lead.findFirst({
      where: { id, companyId: session.companyId },
      select: { id: true, name: true },
    });
    if (!row) return jsonError(404, "NOT_FOUND", "Lead not found");
    await prisma.lead.update({
      where: { id: row.id },
      data: { siteReport: trimmed.length ? trimmed : null },
    });
    await logActivity(prisma, {
      companyId: session.companyId,
      userId: session.sub,
      type: ACTIVITY_TYPES.LEAD_STATUS_CHANGED,
      message: `Lead "${row.name}" notes updated`,
      metadata: { leadId: row.id, leadName: row.name },
    });
  }

  return jsonSuccess({ ok: true });
}
