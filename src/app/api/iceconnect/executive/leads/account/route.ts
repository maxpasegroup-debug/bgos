import { CompanyPlan, IceconnectMetroStage, OnboardingWorkflowPlanTier, UserRole } from "@prisma/client";
import { randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBodyZod } from "@/lib/api-response";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { flowV3StageFromDb, flowV3StageToDb } from "@/lib/iceconnect-lead-flow-v3";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { prisma } from "@/lib/prisma";
import { assertIceconnectInternalSalesOrg } from "@/lib/require-iceconnect-internal-org";
import {
  ensureCustomOnboardingTemplatesForCompany,
  ensureOnboardingTemplatesForCompany,
  WORKFLOW_CUSTOM_CATEGORY,
  WORKFLOW_SOLAR_CATEGORY,
} from "@/lib/onboarding-workflow-templates";

const ROLES: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.MANAGER,
  UserRole.TECH_HEAD,
  UserRole.TECH_EXECUTIVE,
];

const bodySchema = z.object({
  leadId: z.string().trim().min(1),
  industry: z.enum(["solar", "custom"]),
  mode: z.enum(["send_form", "fill_for_client"]),
});

function toPlanTier(plan: CompanyPlan): OnboardingWorkflowPlanTier {
  if (plan === CompanyPlan.ENTERPRISE) return "ENTERPRISE";
  if (plan === CompanyPlan.PRO) return "PRO";
  return "BASIC";
}

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;
  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { leadId, industry, mode } = parsed.data;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId: session.companyId },
    select: { id: true, assignedTo: true, iceconnectMetroStage: true },
  });
  if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");
  if (!(isIceconnectPrivileged(session.role) || lead.assignedTo === session.sub)) {
    return jsonError(403, "FORBIDDEN", "Only the assignee or manager can create account workflow.");
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { plan: true },
  });
  const planTier = toPlanTier(company?.plan ?? CompanyPlan.BASIC);
  const category = industry === "custom" ? WORKFLOW_CUSTOM_CATEGORY : WORKFLOW_SOLAR_CATEGORY;

  if (industry === "custom") {
    await ensureCustomOnboardingTemplatesForCompany(session.companyId);
  } else {
    await ensureOnboardingTemplatesForCompany(session.companyId);
  }

  const template = await prisma.onboardingFormTemplate.findUnique({
    where: {
      companyId_category_planTier: {
        companyId: session.companyId,
        category,
        planTier,
      },
    },
    select: { id: true },
  });
  if (!template) return jsonError(404, "NO_TEMPLATE", "Onboarding template is unavailable.");

  let submission = await prisma.onboardingSubmission.findUnique({
    where: { leadId },
    select: { id: true, clientAccessToken: true, status: true },
  });

  if (!submission) {
    submission = await prisma.onboardingSubmission.create({
      data: {
        companyId: session.companyId,
        leadId,
        templateId: template.id,
        category,
        planTier,
        filledByUserId: session.sub,
        clientAccessToken: randomBytes(24).toString("hex"),
        status: "DRAFT",
        data: {},
        completionPercent: 0,
      },
      select: { id: true, clientAccessToken: true, status: true },
    });
  }

  const cur = flowV3StageFromDb(lead.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED);
  if (cur !== "CREATE_ACCOUNT" && cur !== "ONBOARDING" && cur !== "LIVE") {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        iceconnectMetroStage: flowV3StageToDb("CREATE_ACCOUNT"),
      },
    });
  }

  const onboardingRoute = `/onboarding/${industry}?submissionId=${encodeURIComponent(
    submission.id,
  )}&token=${encodeURIComponent(submission.clientAccessToken)}&mode=${encodeURIComponent(mode)}`;

  return NextResponse.json({
    ok: true as const,
    onboardingFormId: submission.id,
    industryType: industry,
    submittedBy: session.sub,
    shareUrl: `/onboarding/fill/${submission.clientAccessToken}`,
    manageUrl: `/onboarding/manage/${submission.id}`,
    onboardingRoute,
  });
}

