import {
  CompanyBusinessType,
  CompanyPlan,
  CompanySubscriptionStatus,
  OnboardingWorkflowPlanTier,
} from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { mintSessionAccessTokenForUser } from "@/lib/mint-session-token";
import { setSessionCookie } from "@/lib/session-cookie";
import {
  computeCompletionPercent,
  type WorkflowTemplateSections,
} from "@/lib/onboarding-workflow-types";
import {
  ensureCustomOnboardingTemplatesForCompany,
  WORKFLOW_CUSTOM_CATEGORY,
} from "@/lib/onboarding-workflow-templates";
import { finalizeSubmissionToSubmitted } from "@/lib/onboarding-workflow-finalize";

const bodySchema = z.object({
  data: z.record(z.string(), z.string()),
});

function tierFromCompanyPlan(plan: CompanyPlan): OnboardingWorkflowPlanTier {
  if (plan === CompanyPlan.PRO) return OnboardingWorkflowPlanTier.PRO;
  if (plan === CompanyPlan.ENTERPRISE) return OnboardingWorkflowPlanTier.ENTERPRISE;
  return OnboardingWorkflowPlanTier.BASIC;
}

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const co = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: {
        businessType: true,
        subscriptionStatus: true,
        customOnboardingSubmittedAt: true,
        plan: true,
      },
    });
    if (!co) return jsonError(404, "NOT_FOUND", "Company not found");

    if (co.businessType !== CompanyBusinessType.CUSTOM) {
      return jsonError(400, "NOT_CUSTOM", "This endpoint is only for custom business workspaces.");
    }
    if (co.subscriptionStatus === CompanySubscriptionStatus.PAYMENT_PENDING) {
      return jsonError(
        403,
        "PAYMENT_REQUIRED",
        "Complete subscription payment before submitting the requirements form.",
      );
    }
    if (co.customOnboardingSubmittedAt) {
      return jsonError(400, "ALREADY_SUBMITTED", "Custom requirements were already submitted.");
    }

    await ensureCustomOnboardingTemplatesForCompany(session.companyId);

    const wfTier = tierFromCompanyPlan(co.plan);

    const template = await prisma.onboardingFormTemplate.findUnique({
      where: {
        companyId_category_planTier: {
          companyId: session.companyId,
          category: WORKFLOW_CUSTOM_CATEGORY,
          planTier: wfTier,
        },
      },
    });
    if (!template) {
      return jsonError(500, "NO_TEMPLATE", "Custom form template missing — contact support.");
    }

    const sections = template.sections as unknown as WorkflowTemplateSections;
    const data = parsed.data.data;
    const completionPercent = computeCompletionPercent(sections, data);

    const clientAccessToken = randomBytes(24).toString("hex");

    const sub = await prisma.onboardingSubmission.create({
      data: {
        companyId: session.companyId,
        leadId: null,
        templateId: template.id,
        category: WORKFLOW_CUSTOM_CATEGORY,
        planTier: wfTier,
        filledByUserId: session.sub,
        clientAccessToken,
        status: "DRAFT",
        data: data as object,
        completionPercent,
      },
      select: { id: true },
    });

    await finalizeSubmissionToSubmitted(sub.id);

    await prisma.$transaction([
      prisma.company.update({
        where: { id: session.companyId },
        data: { customOnboardingSubmittedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: session.sub },
        data: { workspaceActivatedAt: new Date() },
      }),
    ]);

    const newToken = await mintSessionAccessTokenForUser({
      userId: session.sub,
      email: session.email,
      activeCompanyId: session.companyId,
    });

    const res = NextResponse.json({
      ok: true as const,
      submissionId: sub.id,
      redirect: "/bgos" as const,
    });
    await setSessionCookie(res, newToken);
    return res;
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST /api/onboarding/custom/submit", e);
  }
}
