import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import {
  assertInternalSalesSession,
  canManageInternalSalesAssignments,
} from "@/lib/internal-sales-org";
import { createOnboardingTaskForLead } from "@/lib/internal-sales-onboarding";
import { prisma } from "@/lib/prisma";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

const bodySchema = z.object({
  companyName: z.string().trim().min(1).max(300),
  ownerName: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(32),
  email: z.union([z.string().trim().email().max(320), z.literal("")]).optional(),
  businessType: z.string().trim().max(200).optional(),
  teamSize: z.string().trim().max(100).optional(),
  leadSources: z.string().trim().max(2000).optional(),
  problems: z.string().trim().max(5000).optional(),
  requirements: z.string().trim().max(5000).optional(),
  plan: z.string().trim().max(200).optional(),
  whatsApp: z.string().trim().max(32).optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const internalCtx = await assertInternalSalesSession(session);
  if (internalCtx instanceof Response) return internalCtx;

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  const { id: leadId } = await ctx.params;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId: internalCtx.companyId },
    select: { id: true, assignedTo: true },
  });
  if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");

  const isManager = canManageInternalSalesAssignments(session);
  if (!isManager && lead.assignedTo !== session.sub) {
    return jsonError(403, "FORBIDDEN", "Only your leads or a manager can start onboarding");
  }
  if (!isManager && lead.assignedTo === null) {
    return jsonError(403, "FORBIDDEN", "Assign this lead first or ask a manager");
  }

  const existing = await prisma.onboardingTask.findUnique({ where: { leadId } });
  if (existing) return jsonError(409, "DUPLICATE", "Onboarding already started for this lead");

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const task = await createOnboardingTaskForLead({
    companyId: internalCtx.companyId,
    leadId,
    createdByUserId: session.sub,
    snapshot: {
      companyName: parsed.data.companyName,
      ownerName: parsed.data.ownerName,
      phone: parsed.data.phone,
      email: parsed.data.email && parsed.data.email.trim() !== "" ? parsed.data.email.trim() : null,
      businessType: parsed.data.businessType,
      teamSize: parsed.data.teamSize,
      leadSources: parsed.data.leadSources,
      problems: parsed.data.problems,
      requirements: parsed.data.requirements,
      plan: parsed.data.plan,
      whatsApp: parsed.data.whatsApp,
    },
    closeWon: true,
  });

  return jsonSuccess({ onboardingTaskId: task.id }, 201);
}
