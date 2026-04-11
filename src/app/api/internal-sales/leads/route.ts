import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { InternalCallStatus, InternalSalesStage, type OnboardingTaskStatus } from "@prisma/client";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import {
  assertInternalSalesSession,
  canManageInternalSalesAssignments,
  findDuplicateInternalLeadDetailed,
  INTERNAL_CALL_LABELS,
  INTERNAL_SALES_STAGES,
  internalStageToLeadStatus,
  isInternalSalesAssignableRole,
  normalizeInternalSalesEmail,
  normalizeInternalSalesPhone,
  stageLabel,
} from "@/lib/internal-sales-org";
import { INTERNAL_ACTIVITY, logInternalLeadActivity } from "@/lib/internal-sales-activity";
import { onboardingUiStatus } from "@/lib/internal-sales-onboarding";
import { notifyInternalUsers } from "@/lib/internal-sales-notifications";
import { prisma } from "@/lib/prisma";
import { findUserInCompany, getUserCompanyMembership } from "@/lib/user-company";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

function serializeLead(
  lead: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    leadCompanyName: string | null;
    businessType: string | null;
    internalSalesNotes: string | null;
    internalSalesStage: InternalSalesStage | null;
    internalCallStatus: InternalCallStatus | null;
    lastContactedAt: Date | null;
    nextFollowUpAt: Date | null;
    assignedTo: string | null;
    createdAt: Date;
    updatedAt: Date;
    assignee: { id: string; name: string; email: string } | null;
  },
  onboardingTask: { status: OnboardingTaskStatus } | null,
) {
  const stage = lead.internalSalesStage ?? InternalSalesStage.NEW_LEAD;
  const call = lead.internalCallStatus ?? InternalCallStatus.NOT_CALLED;
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    companyName: lead.leadCompanyName,
    businessType: lead.businessType,
    notes: lead.internalSalesNotes,
    stage,
    stageLabel: stageLabel(stage),
    callStatus: call,
    callStatusLabel: INTERNAL_CALL_LABELS[call],
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
    assignedTo: lead.assignedTo,
    assignee: lead.assignee,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    onboardingStatus: onboardingUiStatus(onboardingTask),
  };
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  companyName: z.string().trim().max(200).optional(),
  phone: z.string().trim().min(1).max(32),
  email: z.union([z.string().trim().email().max(320), z.literal("")]).optional(),
  businessType: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(5000).optional(),
  assignedToUserId: z.string().cuid().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  const employeeId = request.nextUrl.searchParams.get("employeeId");
  const stageParam = request.nextUrl.searchParams.get("stage");

  const where: Prisma.LeadWhereInput = { companyId: ctx.companyId };

  if (canManageInternalSalesAssignments(session)) {
    if (employeeId === "unassigned") where.assignedTo = null;
    else if (employeeId) where.assignedTo = employeeId;
  } else {
    where.assignedTo = session.sub;
  }

  if (stageParam && (Object.values(InternalSalesStage) as string[]).includes(stageParam)) {
    where.internalSalesStage = stageParam as InternalSalesStage;
  }

  const leads = await prisma.lead.findMany({
    where,
    include: { assignee: { select: { id: true, name: true, email: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const taskRows =
    leads.length > 0
      ? await prisma.onboardingTask.findMany({
          where: { leadId: { in: leads.map((l) => l.id) } },
          select: { leadId: true, status: true },
        })
      : [];
  const taskByLead = new Map(taskRows.map((t) => [t.leadId, t]));

  const byStage = new Map<InternalSalesStage, ReturnType<typeof serializeLead>[]>();
  for (const s of INTERNAL_SALES_STAGES) byStage.set(s.key, []);

  for (const lead of leads) {
    const stage = lead.internalSalesStage ?? InternalSalesStage.NEW_LEAD;
    const ob = taskByLead.get(lead.id) ?? null;
    const card = serializeLead(lead, ob);
    const list = byStage.get(stage);
    if (list) list.push(card);
    else {
      byStage.get(InternalSalesStage.NEW_LEAD)!.push(card);
    }
  }

  const pipeline = INTERNAL_SALES_STAGES.map((s) => ({
    key: s.key,
    label: s.label,
    leads: byStage.get(s.key) ?? [],
  }));

  return jsonSuccess({ pipeline });
}

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  const parsed = await parseJsonBodyZod(request, createSchema);
  if (!parsed.ok) return parsed.response;

  const normalized = normalizeInternalSalesPhone(parsed.data.phone);
  if (!normalized) {
    return jsonError(400, "VALIDATION", "Phone is required");
  }

  const emailNorm = normalizeInternalSalesEmail(
    parsed.data.email && parsed.data.email.trim() !== "" ? parsed.data.email : null,
  );

  const dup = await findDuplicateInternalLeadDetailed(ctx.companyId, {
    normalizedPhone: normalized,
    normalizedEmail: emailNorm,
  });
  if (dup) {
    return jsonError(409, "DUPLICATE", "Lead already exists", {
      match: dup.match,
      existingLead: { id: dup.id, name: dup.name, phone: dup.phone, email: dup.email },
    });
  }

  let assignedTo: string | null = session.sub;
  if (parsed.data.assignedToUserId !== undefined) {
    if (!canManageInternalSalesAssignments(session)) {
      return jsonError(403, "FORBIDDEN", "Only a manager can assign someone else");
    }
    const u = await findUserInCompany(parsed.data.assignedToUserId, ctx.companyId);
    if (!u) return jsonError(404, "NOT_FOUND", "Team member not found");
    const mem = await getUserCompanyMembership(parsed.data.assignedToUserId, ctx.companyId);
    if (!mem || !isInternalSalesAssignableRole(mem.jobRole)) {
      return jsonError(400, "INVALID_ASSIGNEE", "Lead can only be assigned to sales manager, sales executive, or telecaller");
    }
    assignedTo = u.id;
  }

  const email =
    parsed.data.email && parsed.data.email.trim() !== "" ? parsed.data.email.trim() : null;

  const lead = await prisma.lead.create({
    data: {
      name: parsed.data.name.trim(),
      phone: normalized,
      email,
      leadCompanyName: parsed.data.companyName?.trim() || undefined,
      businessType: parsed.data.businessType?.trim() || undefined,
      internalSalesNotes: parsed.data.notes?.trim() || undefined,
      companyId: ctx.companyId,
      assignedTo,
      createdByUserId: session.sub,
      source: "internal",
      status: internalStageToLeadStatus(InternalSalesStage.NEW_LEAD),
      internalSalesStage: InternalSalesStage.NEW_LEAD,
      internalCallStatus: InternalCallStatus.NOT_CALLED,
    },
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });

  await logInternalLeadActivity({
    companyId: ctx.companyId,
    leadId: lead.id,
    userId: session.sub,
    action: INTERNAL_ACTIVITY.CREATED,
    detail: `Lead created: ${lead.name}`,
  });

  if (assignedTo && assignedTo !== session.sub) {
    await notifyInternalUsers({
      companyId: ctx.companyId,
      userIds: [assignedTo],
      type: "LEAD_ASSIGNED",
      title: "New lead assigned",
      body: `${lead.name} — check My Leads.`,
      dedupeKey: `assign:${lead.id}:${assignedTo}`,
    });
  }

  return jsonSuccess({ lead: serializeLead(lead, null) }, 201);
}
