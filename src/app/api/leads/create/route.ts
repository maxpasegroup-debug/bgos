import { LeadStatus, LeadSourceType, TaskStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { LEAD_ACTIVITY, logLeadActivity } from "@/lib/lead-activity";
import { leadStatusLabel } from "@/lib/lead-pipeline";
import { serializeLead } from "@/lib/lead-serialize";
import { isAutomationCenterEnabled } from "@/lib/automation-center";
import { handleLeadCreated } from "@/lib/automation-engine";
import { prisma } from "@/lib/prisma";
import { handleNewLead } from "@/lib/nexa-engine";
import { runNexaAutonomousEvent } from "@/lib/nexa-autonomous-engine";
import { runAutomationExecution } from "@/lib/automation-execution";
import { createLeadTask, dueDateCallLead, taskTitleCallLead } from "@/lib/task-engine";
import { findUserInCompany } from "@/lib/user-company";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";
import { checkCompanyLimit } from "@/lib/company-limits";
import { touchCompanyUsageAfterLimitsOrPlanChange } from "@/lib/usage-metrics-engine";
import {
  duplicateIdentityResponse,
  findLeadByIdentity,
  normalizeEmail,
  normalizePhone,
  ownershipRoleFromEmployeeRole,
  sourceTypeFromRole,
} from "@/lib/lead-ownership";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(32),
  email: z.union([z.literal(""), z.string().trim().email().max(320)]).optional(),
  company: z.string().trim().max(200).optional(),
  industry: z.string().trim().max(120).optional(),
  value: z.number().nonnegative().optional(),
  assignedToUserId: z.string().optional(),
  partnerId: z.string().cuid().optional(),
  automationAction: z.enum(["assign", "whatsapp", "both"]).optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  if (await isCompanyBasicTrialExpired(session.companyId, session.email)) {
    return trialExpiredJsonResponse();
  }

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { name, phone, email, company, industry, value, assignedToUserId, partnerId, automationAction } = parsed.data;
  const companyId = session.companyId;
  const actorId = session.sub;
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email ?? null);
  const dup = await findLeadByIdentity({
    companyId,
    phone: normalizedPhone,
    email: normalizedEmail,
  });
  if (dup) {
    return NextResponse.json(duplicateIdentityResponse(dup), { status: 409 });
  }
  const leadLimit = await checkCompanyLimit(companyId, "lead");
  if (!leadLimit.ok) {
    return jsonError(403, "LIMIT_REACHED", leadLimit.message);
  }

  let assigneeId = actorId;
  if (assignedToUserId !== undefined) {
    const assignee = await findUserInCompany(assignedToUserId, companyId);
    if (!assignee) {
      return jsonError(404, "NOT_FOUND", "Assignee not found in your company");
    }
    assigneeId = assignee.id;
  }

  if (partnerId) {
    const partner = await (prisma as any).channelPartner.findFirst({
      where: { id: partnerId, companyId },
      select: { id: true },
    });
    if (!partner) {
      return jsonError(404, "NOT_FOUND", "Partner not found in your company");
    }
  }

  const leadRow = await prisma.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: {
        name,
        phone: normalizedPhone ?? phone,
        email: normalizedEmail,
        value: value ?? null,
        leadCompanyName: company?.trim() || null,
        businessType: industry?.trim() || null,
        companyId,
        createdByUserId: actorId,
        assignedTo: assigneeId,
        ownerUserId: assigneeId,
        ownerRole:
          ownershipRoleFromEmployeeRole(session.iceconnectEmployeeRole) ??
          ownershipRoleFromEmployeeRole(session.role),
        sourceType: sourceTypeFromRole(session.iceconnectEmployeeRole, LeadSourceType.INBOUND),
        sourceUserId: actorId,
        ...(partnerId ? { partnerId } : {}),
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

  const nexaResult = await handleNewLead({ leadId: leadRow.id, companyId, actorUserId: actorId });

  if (
    nexaResult.reassigned &&
    nexaResult.assignedUserId &&
    nexaResult.assignedUserId !== assigneeId
  ) {
    await prisma.task.updateMany({
      where: {
        leadId: leadRow.id,
        companyId,
        status: TaskStatus.PENDING,
        userId: assigneeId,
      },
      data: { userId: nexaResult.assignedUserId },
    });
  }

  const automationCenterOn = await isAutomationCenterEnabled(companyId);
  if (automationCenterOn) {
    await handleLeadCreated({
      lead: {
        id: leadRow.id,
        companyId,
        assignedTo: leadRow.assignedTo,
      },
      actorUserId: actorId,
      assigneeExplicit: assignedToUserId !== undefined,
      initialAssigneeId: assigneeId,
      modeOverride: automationAction,
    });
  }

  const leadForAutomation = await prisma.lead.findUnique({
    where: { id: leadRow.id },
    select: { id: true, name: true, companyId: true, assignedTo: true },
  });

  if (leadForAutomation && automationCenterOn) {
    await runAutomationExecution(companyId, "LEAD_CREATED", {
      lead: leadForAutomation,
    });
    await runNexaAutonomousEvent({
      companyId,
      actorUserId: actorId,
      event: "lead_created",
      payload: { leadId: leadForAutomation.id },
    });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadRow.id },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  });
  if (!lead) {
    return jsonError(500, "INTERNAL", "Lead not found after create");
  }
  void touchCompanyUsageAfterLimitsOrPlanChange(companyId).catch((e) => {
    console.error("[usage-metrics] failed after lead create", e);
  });

  return jsonSuccess({ lead: serializeLead(lead) }, 201);
}
