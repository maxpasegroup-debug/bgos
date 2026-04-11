import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import {
  assertInternalSalesSession,
  canManageInternalSalesAssignments,
  isInternalSalesAssignableRole,
} from "@/lib/internal-sales-org";
import { INTERNAL_ACTIVITY, logInternalLeadActivity } from "@/lib/internal-sales-activity";
import { notifyInternalUsers } from "@/lib/internal-sales-notifications";
import { prisma } from "@/lib/prisma";
import { findUserInCompany, getUserCompanyMembership } from "@/lib/user-company";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

const bodySchema = z.object({
  leadIds: z.array(z.string().cuid()).min(1).max(200),
  assignedToUserId: z.string().cuid(),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (!canManageInternalSalesAssignments(session)) {
    return jsonError(403, "FORBIDDEN", "Manager only");
  }

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const assignee = await findUserInCompany(parsed.data.assignedToUserId, ctx.companyId);
  if (!assignee) return jsonError(404, "NOT_FOUND", "Team member not found");
  const assignMem = await getUserCompanyMembership(parsed.data.assignedToUserId, ctx.companyId);
  if (!assignMem || !isInternalSalesAssignableRole(assignMem.jobRole)) {
    return jsonError(400, "INVALID_ASSIGNEE", "Lead can only be assigned to sales manager, sales executive, or telecaller");
  }

  const { count } = await prisma.lead.updateMany({
    where: { id: { in: parsed.data.leadIds }, companyId: ctx.companyId },
    data: { assignedTo: assignee.id },
  });

  for (const leadId of parsed.data.leadIds) {
    await logInternalLeadActivity({
      companyId: ctx.companyId,
      leadId,
      userId: session.sub,
      action: INTERNAL_ACTIVITY.ASSIGNED,
      detail: "Bulk assign",
      metadata: { assignedTo: assignee.id },
    });
  }

  await notifyInternalUsers({
    companyId: ctx.companyId,
    userIds: [assignee.id],
    type: "BULK_ASSIGNED",
    title: "Leads assigned",
    body: `${count} leads assigned to you.`,
    dedupeKey: `bulk:${assignee.id}:${Date.now()}`,
  });

  return jsonSuccess({ updated: count });
}
