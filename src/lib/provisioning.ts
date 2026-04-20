import "server-only";

import {
  CompanyBusinessType,
  CompanyIndustry,
  CompanyPlan,
  CompanySubscriptionStatus,
  EmployeeDomain,
  EmployeeSystem,
  OnboardingRequestDashboardType,
  OnboardingRequestStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { companyMembershipClass } from "@/lib/user-company";
import { touchCompanyUsageAfterLimitsOrPlanChange } from "@/lib/usage-metrics-engine";

function industryFromDashboard(t: OnboardingRequestDashboardType): {
  industry: CompanyIndustry;
  businessType: CompanyBusinessType;
} {
  switch (t) {
    case OnboardingRequestDashboardType.SOLAR:
      return { industry: CompanyIndustry.SOLAR, businessType: CompanyBusinessType.SOLAR };
    case OnboardingRequestDashboardType.BUILDER:
    case OnboardingRequestDashboardType.ACADEMY:
    case OnboardingRequestDashboardType.CUSTOM:
      return { industry: CompanyIndustry.CUSTOM, businessType: CompanyBusinessType.CUSTOM };
    default:
      return { industry: CompanyIndustry.SOLAR, businessType: CompanyBusinessType.SOLAR };
  }
}

function workspaceAndBossDomainFromTemplate(t: OnboardingRequestDashboardType): {
  workspaceDomain: EmployeeDomain;
  bossDomain: EmployeeDomain;
} {
  switch (t) {
    case OnboardingRequestDashboardType.SOLAR:
      return { workspaceDomain: EmployeeDomain.SOLAR, bossDomain: EmployeeDomain.SOLAR };
    case OnboardingRequestDashboardType.BUILDER:
    case OnboardingRequestDashboardType.ACADEMY:
    case OnboardingRequestDashboardType.CUSTOM:
      return { workspaceDomain: EmployeeDomain.BGOS, bossDomain: EmployeeDomain.BGOS };
    default:
      return { workspaceDomain: EmployeeDomain.SOLAR, bossDomain: EmployeeDomain.SOLAR };
  }
}

/** Default CRM pipeline + settings stored in {@link Company.dashboardConfig}. */
function seedDashboardConfig(template: OnboardingRequestDashboardType): Prisma.InputJsonValue {
  switch (template) {
    case OnboardingRequestDashboardType.SOLAR:
      return {
        version: 1,
        template: "solar",
        pipelineStages: [
          { key: "new", label: "New", order: 0 },
          { key: "qualified", label: "Qualified", order: 1 },
          { key: "proposal", label: "Proposal", order: 2 },
          { key: "won", label: "Won", order: 3 },
        ],
        settings: { currency: "INR", timezone: "Asia/Kolkata" },
      };
    case OnboardingRequestDashboardType.BUILDER:
      return {
        version: 1,
        template: "builder",
        pipelineStages: [
          { key: "inquiry", label: "Inquiry", order: 0 },
          { key: "estimate", label: "Estimate", order: 1 },
          { key: "contract", label: "Contract", order: 2 },
        ],
        settings: { currency: "INR", timezone: "Asia/Kolkata" },
      };
    case OnboardingRequestDashboardType.ACADEMY:
      return {
        version: 1,
        template: "academy",
        pipelineStages: [
          { key: "lead", label: "Lead", order: 0 },
          { key: "trial", label: "Trial", order: 1 },
          { key: "enrolled", label: "Enrolled", order: 2 },
        ],
        settings: { currency: "INR", timezone: "Asia/Kolkata" },
      };
    case OnboardingRequestDashboardType.CUSTOM:
    default:
      return {
        version: 1,
        template: "custom",
        pipelineStages: [{ key: "open", label: "Open", order: 0 }],
        settings: { currency: "INR", timezone: "Asia/Kolkata" },
      };
  }
}

/**
 * Creates company + boss (or links existing user), seeds limits and default dashboard config.
 * Does not mutate onboarding row — caller sets status to COMPLETED on success.
 */
export async function provisionCompany(requestId: string): Promise<
  | { ok: true; userId: string; companyId: string; message: string }
  | { ok: false; error: string; code?: string }
> {
  const req = await prisma.onboardingRequest.findUnique({ where: { id: requestId } });
  if (!req) {
    return { ok: false, error: "Onboarding request not found", code: "NOT_FOUND" };
  }
  if (req.status !== OnboardingRequestStatus.TECH_QUEUE) {
    return {
      ok: false,
      error: "Request must be in tech queue before provisioning",
      code: "INVALID_STATUS",
    };
  }

  const template = req.template;
  const { industry, businessType } = industryFromDashboard(template);
  const { workspaceDomain, bossDomain } = workspaceAndBossDomainFromTemplate(template);
  const dashboardConfig = seedDashboardConfig(template);
  const email = req.bossEmail.trim().toLowerCase();
  const companyName = req.companyName.trim().slice(0, 200);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });

      let bossId: string;

      if (existing) {
        bossId = existing.id;
        await tx.user.update({
          where: { id: bossId },
          data: { employeeSystem: EmployeeSystem.BGOS, employeeDomain: bossDomain },
        });

        const company = await tx.company.create({
          data: {
            name: companyName,
            ownerId: bossId,
            industry,
            businessType,
            plan: CompanyPlan.BASIC,
            subscriptionStatus: CompanySubscriptionStatus.TRIAL,
            isTrialActive: true,
            workspaceDomain,
            dashboardTemplate: template,
            dashboardConfig,
          },
        });

        await tx.userCompany.create({
          data: {
            userId: bossId,
            companyId: company.id,
            role: companyMembershipClass(UserRole.ADMIN),
            jobRole: UserRole.ADMIN,
          },
        });

        await tx.companyLimit.create({
          data: {
            companyId: company.id,
            maxUsers: 12,
            maxLeads: 300,
            maxProjects: 50,
          },
        });

        return { userId: bossId, companyId: company.id };
      }

      const tempPass = randomBytes(16).toString("base64url");
      const passwordHash = await hashPassword(tempPass);

      const boss = await tx.user.create({
        data: {
          name: companyName.slice(0, 120),
          email,
          password: passwordHash,
          firstLogin: true,
          forcePasswordReset: true,
          employeeSystem: EmployeeSystem.BGOS,
          employeeDomain: bossDomain,
        },
      });
      bossId = boss.id;

      const company = await tx.company.create({
        data: {
          name: companyName,
          ownerId: bossId,
          industry,
          businessType,
          plan: CompanyPlan.BASIC,
          subscriptionStatus: CompanySubscriptionStatus.TRIAL,
          isTrialActive: true,
          workspaceDomain,
          dashboardTemplate: template,
          dashboardConfig,
        },
      });

      await tx.userCompany.create({
        data: {
          userId: bossId,
          companyId: company.id,
          role: companyMembershipClass(UserRole.ADMIN),
          jobRole: UserRole.ADMIN,
        },
      });

      await tx.companyLimit.create({
        data: {
          companyId: company.id,
          maxUsers: 12,
          maxLeads: 300,
          maxProjects: 50,
        },
      });

      return { userId: bossId, companyId: company.id };
    });

    const label =
      template === OnboardingRequestDashboardType.SOLAR
        ? "Solar"
        : template === OnboardingRequestDashboardType.BUILDER
          ? "Builder"
          : template === OnboardingRequestDashboardType.ACADEMY
            ? "Academy"
            : "Custom";

    void touchCompanyUsageAfterLimitsOrPlanChange(result.companyId).catch((e) =>
      console.error("[provisioning] usage metrics touch failed", e),
    );

    console.info("[provisioning] provisionCompany ok", {
      requestId,
      userId: result.userId,
      companyId: result.companyId,
      template,
    });
    console.info(
      "[provisioning] Email stub: Your dashboard is ready — sign in at bgos.online",
    );

    return {
      ok: true,
      userId: result.userId,
      companyId: result.companyId,
      message: `Your ${label} Dashboard is ready 🚀\nLet’s start managing your business.`,
    };
  } catch (e) {
    console.error("[provisioning] provisionCompany failed", { requestId, error: e });
    return { ok: false, error: "Could not provision workspace", code: "PROVISION_FAILED" };
  }
}
