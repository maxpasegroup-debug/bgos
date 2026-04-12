import type { NextRequest } from "next/server";
import { InternalOnboardingApprovalStatus, InternalSalesStage } from "@prisma/client";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import {
  assertInternalSalesSession,
  canManageInternalSalesAssignments,
} from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

export async function GET(request: NextRequest) {
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

  const leads = await prisma.lead.findMany({
    where: {
      companyId: ctx.companyId,
      internalSalesStage: InternalSalesStage.ONBOARDING_FORM_FILLED,
      internalOnboardingApprovalStatus: InternalOnboardingApprovalStatus.PENDING,
    },
    orderBy: { updatedAt: "desc" },
    include: { assignee: { select: { id: true, name: true, email: true } } },
    take: 100,
  });

  return jsonSuccess({
    leads: leads.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      companyName: l.leadCompanyName,
      assignedTo: l.assignedTo,
      assignee: l.assignee,
      updatedAt: l.updatedAt.toISOString(),
    })),
  });
}
