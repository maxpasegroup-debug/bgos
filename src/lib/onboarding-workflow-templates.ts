import "server-only";

import type { OnboardingWorkflowPlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { customTemplateSections, solarTemplateSections } from "@/lib/onboarding-workflow-types";

export const WORKFLOW_SOLAR_CATEGORY = "solar";
export const WORKFLOW_CUSTOM_CATEGORY = "custom";

export async function ensureOnboardingTemplatesForCompany(
  companyId: string,
): Promise<void> {
  const tiers: OnboardingWorkflowPlanTier[] = ["BASIC", "PRO", "ENTERPRISE"];
  for (const planTier of tiers) {
    const sections = solarTemplateSections(planTier);
    await prisma.onboardingFormTemplate.upsert({
      where: {
        companyId_category_planTier: {
          companyId,
          category: WORKFLOW_SOLAR_CATEGORY,
          planTier,
        },
      },
      create: {
        companyId,
        category: WORKFLOW_SOLAR_CATEGORY,
        planTier,
        sections: sections as object,
        isActive: true,
      },
      update: {
        sections: sections as object,
        isActive: true,
      },
    });
  }
}

export async function ensureCustomOnboardingTemplatesForCompany(companyId: string): Promise<void> {
  const tiers: OnboardingWorkflowPlanTier[] = ["BASIC", "PRO", "ENTERPRISE"];
  for (const planTier of tiers) {
    const sections = customTemplateSections(planTier);
    await prisma.onboardingFormTemplate.upsert({
      where: {
        companyId_category_planTier: {
          companyId,
          category: WORKFLOW_CUSTOM_CATEGORY,
          planTier,
        },
      },
      create: {
        companyId,
        category: WORKFLOW_CUSTOM_CATEGORY,
        planTier,
        sections: sections as object,
        isActive: true,
      },
      update: {
        sections: sections as object,
        isActive: true,
      },
    });
  }
}
