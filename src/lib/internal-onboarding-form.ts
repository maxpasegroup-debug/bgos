import "server-only";

import { LeadOnboardingType } from "@prisma/client";
import { z } from "zod";

const commonFields = {
  companyName: z.string().trim().min(1, "Company name is required").max(300),
  ownerName: z.string().trim().min(1, "Owner name is required").max(200),
  phone: z.string().trim().min(1, "Phone is required").max(32),
  email: z.string().trim().email("Valid email required").max(320),
  businessType: z.string().trim().min(1, "Business type is required").max(200),
  salesTeamCount: z.string().trim().min(1, "Sales team count is required").max(20),
  techTeamCount: z.string().trim().min(1, "Tech team count is required").max(20),
  leadSources: z.string().trim().min(1, "Lead sources are required").max(2000),
  currentProblems: z.string().trim().min(1, "Current problems are required").max(5000),
  requirements: z.string().trim().min(1, "Requirements are required").max(5000),
};

export const internalOnboardingBasicSchema = z.object({
  tier: z.literal("basic"),
  ...commonFields,
});

export const internalOnboardingProSchema = z.object({
  tier: z.literal("pro"),
  ...commonFields,
  whatsApp: z.string().trim().min(1, "WhatsApp is required").max(32),
  socialChannels: z.string().trim().min(1, "Social channels are required").max(2000),
  automationNeeds: z.string().trim().min(1, "Automation needs are required").max(5000),
});

export const internalOnboardingEnterpriseSchema = z.object({
  tier: z.literal("enterprise"),
  ...commonFields,
  customRequirements: z.string().trim().min(1, "Custom requirements are required").max(5000),
  multiBranch: z.string().trim().min(1, "Multi-branch details are required").max(2000),
  integrations: z.string().trim().min(1, "Integrations are required").max(2000),
});

export const internalOnboardingSubmitSchema = z.discriminatedUnion("tier", [
  internalOnboardingBasicSchema,
  internalOnboardingProSchema,
  internalOnboardingEnterpriseSchema,
]);

export type InternalOnboardingSubmit = z.infer<typeof internalOnboardingSubmitSchema>;

export function leadTypeMatchesTier(
  leadType: LeadOnboardingType | null,
  tier: InternalOnboardingSubmit["tier"],
): boolean {
  if (!leadType) return false;
  const map: Record<InternalOnboardingSubmit["tier"], LeadOnboardingType> = {
    basic: LeadOnboardingType.BASIC,
    pro: LeadOnboardingType.PRO,
    enterprise: LeadOnboardingType.ENTERPRISE,
  };
  return leadType === map[tier];
}

export function snapshotFromSubmit(data: InternalOnboardingSubmit) {
  const teamSize = `Sales: ${data.salesTeamCount} · Tech: ${data.techTeamCount}`;
  const base = {
    companyName: data.companyName,
    ownerName: data.ownerName,
    phone: data.phone,
    email: data.email,
    businessType: data.businessType,
    teamSize,
    leadSources: data.leadSources,
    problems: data.currentProblems,
    requirements: data.requirements,
    plan: data.tier === "basic" ? "BASIC" : data.tier === "pro" ? "PRO" : "ENTERPRISE",
    whatsApp:
      data.tier === "pro"
        ? data.whatsApp
        : data.tier === "enterprise"
          ? data.phone
          : data.phone,
  };
  return base;
}

export function formPayloadFromSubmit(data: InternalOnboardingSubmit): Record<string, unknown> {
  const base = {
    salesTeamCount: data.salesTeamCount,
    techTeamCount: data.techTeamCount,
    currentProblems: data.currentProblems,
  };
  if (data.tier === "pro") {
    return {
      ...base,
      whatsApp: data.whatsApp,
      socialChannels: data.socialChannels,
      automationNeeds: data.automationNeeds,
    };
  }
  if (data.tier === "enterprise") {
    return {
      ...base,
      customRequirements: data.customRequirements,
      multiBranch: data.multiBranch,
      integrations: data.integrations,
    };
  }
  return base;
}

export function prismaOnboardingTypeFromTier(
  tier: InternalOnboardingSubmit["tier"],
): LeadOnboardingType {
  if (tier === "basic") return LeadOnboardingType.BASIC;
  if (tier === "pro") return LeadOnboardingType.PRO;
  return LeadOnboardingType.ENTERPRISE;
}
