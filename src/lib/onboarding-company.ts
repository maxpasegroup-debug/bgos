import "server-only";

import {
  CompanyBusinessType,
  CompanyIndustry,
  CompanyPlan,
  CompanySubscriptionStatus,
  EmployeeDomain,
  EmployeeSystem,
  OnboardingRequestDashboardType,
  Prisma,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCompanyLimits } from "@/lib/company-limits";
import { companyMembershipClass } from "@/lib/user-company";

export type RequestedOnboardingIndustry =
  | "SOLAR"
  | "ACADEMY"
  | "BUILDERS"
  | "BUILDER"
  | "CUSTOM";

export type OnboardingCompanyTemplate = {
  dashboardTemplate: OnboardingRequestDashboardType;
  industry: CompanyIndustry;
  businessType: CompanyBusinessType;
  workspaceDomain: EmployeeDomain;
  bossDomain: EmployeeDomain;
  defaultPlan: CompanyPlan;
  subscriptionStatus: CompanySubscriptionStatus;
  isTrialActive: boolean;
};

export function normalizeRequestedIndustry(input: string): RequestedOnboardingIndustry {
  const value = input.trim().toUpperCase();
  if (value === "SOLAR") return "SOLAR";
  if (value === "ACADEMY") return "ACADEMY";
  if (value === "BUILDER") return "BUILDER";
  if (value === "BUILDERS") return "BUILDERS";
  return "CUSTOM";
}

export function mapOnboardingTemplate(input: string): OnboardingCompanyTemplate {
  const normalized = normalizeRequestedIndustry(input);
  if (normalized === "SOLAR") {
    return {
      dashboardTemplate: OnboardingRequestDashboardType.SOLAR,
      industry: CompanyIndustry.SOLAR,
      businessType: CompanyBusinessType.SOLAR,
      workspaceDomain: EmployeeDomain.SOLAR,
      bossDomain: EmployeeDomain.SOLAR,
      defaultPlan: CompanyPlan.BASIC,
      subscriptionStatus: CompanySubscriptionStatus.TRIAL,
      isTrialActive: true,
    };
  }
  if (normalized === "ACADEMY") {
    return {
      dashboardTemplate: OnboardingRequestDashboardType.ACADEMY,
      industry: CompanyIndustry.CUSTOM,
      businessType: CompanyBusinessType.CUSTOM,
      workspaceDomain: EmployeeDomain.BGOS,
      bossDomain: EmployeeDomain.BGOS,
      defaultPlan: CompanyPlan.BASIC,
      subscriptionStatus: CompanySubscriptionStatus.TRIAL,
      isTrialActive: true,
    };
  }
  if (normalized === "BUILDER" || normalized === "BUILDERS") {
    return {
      dashboardTemplate: OnboardingRequestDashboardType.BUILDER,
      industry: CompanyIndustry.CUSTOM,
      businessType: CompanyBusinessType.CUSTOM,
      workspaceDomain: EmployeeDomain.BGOS,
      bossDomain: EmployeeDomain.BGOS,
      defaultPlan: CompanyPlan.BASIC,
      subscriptionStatus: CompanySubscriptionStatus.TRIAL,
      isTrialActive: true,
    };
  }
  return {
    dashboardTemplate: OnboardingRequestDashboardType.CUSTOM,
    industry: CompanyIndustry.CUSTOM,
    businessType: CompanyBusinessType.CUSTOM,
    workspaceDomain: EmployeeDomain.BGOS,
    bossDomain: EmployeeDomain.BGOS,
    defaultPlan: CompanyPlan.PRO,
    subscriptionStatus: CompanySubscriptionStatus.PAYMENT_PENDING,
    isTrialActive: false,
  };
}

export function planFromInput(input: string | null | undefined): CompanyPlan | undefined {
  const value = input?.trim().toUpperCase();
  if (value === "ENTERPRISE") return CompanyPlan.ENTERPRISE;
  if (value === "PRO") return CompanyPlan.PRO;
  if (value === "BASIC") return CompanyPlan.BASIC;
  return undefined;
}

export function onboardingRedirectPath(domain: EmployeeDomain): string {
  return domain === EmployeeDomain.SOLAR ? "/solar-boss" : "/bgos/dashboard";
}

export async function createOnboardingCompany(input: {
  userId: string;
  companyName: string;
  requestedIndustry: string;
  planOverride?: CompanyPlan;
}) {
  const template = mapOnboardingTemplate(input.requestedIndustry);
  const plan = input.planOverride ?? template.defaultPlan;

  const created = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        employeeSystem: EmployeeSystem.BGOS,
        employeeDomain: template.bossDomain,
      },
    });

    const company = await tx.company.create({
      data: {
        name: input.companyName,
        ownerId: input.userId,
        industry: template.industry,
        businessType: template.businessType,
        plan,
        subscriptionStatus: template.subscriptionStatus,
        isTrialActive: template.isTrialActive,
        workspaceDomain: template.workspaceDomain,
        dashboardTemplate: template.dashboardTemplate,
      },
      select: {
        id: true,
        workspaceDomain: true,
        plan: true,
      },
    });

    await tx.userCompany.create({
      data: {
        userId: input.userId,
        companyId: company.id,
        role: companyMembershipClass(UserRole.ADMIN),
        jobRole: UserRole.ADMIN,
      },
    });

    return company;
  });

  await ensureCompanyLimits(created.id);

  return {
    companyId: created.id,
    employeeDomain: created.workspaceDomain,
    plan: created.plan,
    redirectPath: onboardingRedirectPath(created.workspaceDomain),
  };
}

export async function markOnboardingSessionReady(input: {
  sessionId?: string | null;
  userId: string;
  companyId: string;
  companyName: string;
  industry: string;
  parsedTeam?: Prisma.InputJsonValue;
  source?: string | null;
}) {
  const data = {
    companyId: input.companyId,
    companyName: input.companyName,
    industry: input.industry,
    parsedTeam: input.parsedTeam ?? ([] as Prisma.InputJsonValue),
    status: "ready",
    currentStep: "launch",
  };

  if (input.sessionId?.trim()) {
    const existing = await prisma.onboardingSession.findFirst({
      where: {
        id: input.sessionId.trim(),
        createdByUserId: input.userId,
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.onboardingSession.update({
        where: { id: existing.id },
        data,
      });
      return existing.id;
    }
  }

  const created = await prisma.onboardingSession.create({
    data: {
      source: input.source ?? "DIRECT",
      companyId: input.companyId,
      companyName: input.companyName,
      industry: input.industry,
      parsedTeam: input.parsedTeam ?? ([] as Prisma.InputJsonValue),
      unknownRoles: [] as Prisma.InputJsonValue,
      rawTeamInput: "",
      status: "ready",
      currentStep: "launch",
      createdByUserId: input.userId,
    },
    select: { id: true },
  });

  return created.id;
}
