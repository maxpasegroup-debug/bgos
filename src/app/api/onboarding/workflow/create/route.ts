import { OnboardingWorkflowPlanTier } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { assertInternalSalesSession, canManageInternalSalesAssignments } from "@/lib/internal-sales-org";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { ensureOnboardingTemplatesForCompany, WORKFLOW_SOLAR_CATEGORY } from "@/lib/onboarding-workflow-templates";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

const bodySchema = z.object({
  leadId: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).default(WORKFLOW_SOLAR_CATEGORY),
  planTier: z.nativeEnum(OnboardingWorkflowPlanTier),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const internal = await assertInternalSalesSession(session);
  if (internal instanceof NextResponse) return internal;

  if (await isCompanyBasicTrialExpired(session.companyId, session.email)) {
    return trialExpiredJsonResponse();
  }

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { leadId, category, planTier } = parsed.data;

  try {
    await ensureOnboardingTemplatesForCompany(internal.companyId);

    const template = await prisma.onboardingFormTemplate.findUnique({
      where: {
        companyId_category_planTier: {
          companyId: internal.companyId,
          category,
          planTier,
        },
      },
    });
    if (!template) {
      return jsonError(404, "NO_TEMPLATE", "No form template for this category and plan.");
    }

    if (leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, companyId: internal.companyId },
        select: { id: true, assignedTo: true },
      });
      if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");

      const isManager = canManageInternalSalesAssignments(session);
      if (!isManager && lead.assignedTo !== session.sub) {
        return jsonError(403, "FORBIDDEN", "Only the assignee or a manager can create onboarding for this lead.");
      }

      const existing = await prisma.onboardingSubmission.findUnique({
        where: { leadId },
      });
      if (existing) {
        return NextResponse.json(
          {
            ok: false as const,
            error: "Onboarding workflow already exists for this lead.",
            code: "EXISTS" as const,
            details: { submissionId: existing.id, token: existing.clientAccessToken },
          },
          { status: 409 },
        );
      }
    }

    const clientAccessToken = randomBytes(24).toString("hex");

    const sub = await prisma.onboardingSubmission.create({
      data: {
        companyId: internal.companyId,
        leadId: leadId ?? null,
        templateId: template.id,
        category,
        planTier,
        filledByUserId: session.sub,
        clientAccessToken,
        status: "DRAFT",
        data: {},
        completionPercent: 0,
      },
      select: {
        id: true,
        clientAccessToken: true,
        status: true,
        planTier: true,
        category: true,
      },
    });

    return NextResponse.json(
      {
        ok: true as const,
        submission: sub,
        shareUrl: `/onboarding/fill/${sub.clientAccessToken}`,
        manageUrl: `/onboarding/manage/${sub.id}`,
      },
      { status: 201 },
    );
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST /api/onboarding/workflow/create", e);
  }
}
