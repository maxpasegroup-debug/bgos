import "server-only";

import {
  CompanyBusinessType,
  CompanyIndustry,
  CompanyPlan,
  CompanySubscriptionStatus,
  UserRole,
} from "@prisma/client";
import {
  credentialsWorkbookBase64,
  generateEmail,
  generatePassword,
  industryToBusinessType,
  industryToPlan,
  type LaunchCredential,
  type LaunchIndustry,
} from "@/lib/company-launch-engine";
import { applyIndustryTemplate } from "@/lib/industry-templates";
import { createLogger } from "@/lib/logger";
import { loadMembershipsForJwt } from "@/lib/memberships-for-jwt";
import { normalizeMicroFranchisePhone } from "@/lib/micro-franchise-phone";
import { normalizeLogoUrl } from "@/lib/company-profile";
import { buildOnboardingPlan, mapRoles, type NexaMappedMember } from "@/lib/nexa-intelligence";
import { prisma } from "@/lib/prisma";
import { getRoleHome } from "@/lib/role-routing";
import { signAccessToken } from "@/lib/jwt";
import { isSuperBossEmail } from "@/lib/super-boss";
import { hashPassword } from "@/lib/password";
import { trialEndDateFromStart } from "@/lib/trial";
import { companyMembershipClass } from "@/lib/user-company";
import { publicBgosOrigin, publicIceconnectOrigin } from "@/lib/host-routing";

export type OnboardingLaunchIndustry = LaunchIndustry;

export type OnboardingLaunchProfile = {
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  billingAddress?: string | null;
  gstNumber?: string | null;
  bankDetails?: string | null;
};

export type RunOnboardingLaunchInput = {
  ownerUserId: string;
  ownerEmail: string;
  companyName: string;
  industry: OnboardingLaunchIndustry;
  team: NexaMappedMember[];
  referralPhone?: string | null;
  sessionId?: string | null;
  profile?: OnboardingLaunchProfile | null;
  /** Same semantics as legacy `company/create`: more companies after first activation. */
  addingAnotherBusiness: boolean;
  /** When {@link industry} is CUSTOM, use this plan (Basic / Pro / Enterprise) instead of the Nexa default. */
  customWorkspacePlan?: CompanyPlan | null;
};

export type OnboardingLaunchOk = {
  ok: true;
  companyId: string;
  employeesCreated: number;
  dashboardsAssigned: string[];
  credentials: LaunchCredential[];
  credentialsFile: {
    filename: string;
    mimeType: string;
    base64: string;
  };
  pipeline: string[];
  onboardingPlan: ReturnType<typeof buildOnboardingPlan>;
  sessionJwt: string;
  activeCompanyId: string;
  existing?: boolean;
  businessType: CompanyBusinessType;
  requiresCustomPayment?: true;
  nextStep?: "/onboarding/custom/pay";
};

export type OnboardingLaunchFail = {
  ok: false;
  error: string;
  code: "VALIDATION_ERROR" | "FORBIDDEN" | "SERVER_ERROR";
  status?: number;
};

export type OnboardingLaunchResult = OnboardingLaunchOk | OnboardingLaunchFail;

async function uniqueEmail(baseEmail: string): Promise<string> {
  let candidate = baseEmail.toLowerCase();
  let i = 1;
  while (true) {
    const exists = await prisma.user.findFirst({
      where: { email: { equals: candidate, mode: "insensitive" } },
      select: { id: true },
    });
    if (!exists) return candidate;
    const [left, right] = baseEmail.split("@");
    candidate = `${left}.${i}@${right}`;
    i += 1;
  }
}

function loginUrlForRole(role: UserRole): string {
  if (role === UserRole.ADMIN) return `${publicBgosOrigin()}/login`;
  return `${publicIceconnectOrigin()}/iceconnect/login`;
}

/**
 * BGOS for company ADMIN; ICECONNECT (and partner) homes for employee job roles — see {@link ROLE_HOME}.
 */
function dashboardsAssignedFor(employeeJobRoles: UserRole[]): string[] {
  const set = new Set<string>(["/bgos/dashboard"]);
  for (const r of employeeJobRoles) {
    set.add(getRoleHome(r));
  }
  return [...set].sort();
}

export async function runOnboardingLaunch(input: RunOnboardingLaunchInput): Promise<OnboardingLaunchResult> {
  const name = input.companyName.trim();
  if (!name) {
    return { ok: false, error: "Company name is required", code: "VALIDATION_ERROR", status: 400 };
  }

  const existingByOwnerAndName = await prisma.company.findFirst({
    where: { ownerId: input.ownerUserId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingByOwnerAndName) {
    try {
      const ownerRow = await prisma.user.findUnique({
        where: { id: input.ownerUserId },
        select: { name: true, email: true },
      });
      const mems = await loadMembershipsForJwt(input.ownerUserId);
      const primary = mems[0]!;
      const jwtCompany = mems.find((m) => m.companyId === existingByOwnerAndName.id) ?? primary;
      const sessionJwt = signAccessToken({
        sub: input.ownerUserId,
        email: input.ownerEmail,
        role: jwtCompany.jobRole,
        companyId: jwtCompany.companyId,
        companyPlan: jwtCompany.plan,
        workspaceReady: input.addingAnotherBusiness,
        memberships: mems,
        ...(isSuperBossEmail(input.ownerEmail) ? { superBoss: true as const } : {}),
      });
      const dupCreds: LaunchCredential[] = ownerRow
        ? [
            {
              name: ownerRow.name,
              role: UserRole.ADMIN,
              email: ownerRow.email,
              password: "—",
              loginUrl: loginUrlForRole(UserRole.ADMIN),
            },
          ]
        : [];
      return {
        ok: true,
        companyId: existingByOwnerAndName.id,
        employeesCreated: 0,
        dashboardsAssigned: ["/bgos/dashboard"],
        credentials: dupCreds,
        credentialsFile: {
          filename: `${name.replace(/\s+/g, "_")}_credentials.xlsx`,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          base64: credentialsWorkbookBase64(dupCreds),
        },
        pipeline: [],
        onboardingPlan: buildOnboardingPlan({ companyName: name, industry: input.industry, team: [] }),
        sessionJwt,
        activeCompanyId: existingByOwnerAndName.id,
        existing: true,
        businessType: industryToBusinessType(input.industry),
      };
    } catch {
      return { ok: false, error: "Authentication is not configured", code: "SERVER_ERROR", status: 500 };
    }
  }

  let logoUrl: string | null = null;
  const p = input.profile;
  if (p?.logoUrl != null && String(p.logoUrl).trim() !== "") {
    try {
      logoUrl = normalizeLogoUrl(String(p.logoUrl).trim());
    } catch {
      return {
        ok: false,
        error: "Logo must be an https URL or a path starting with /",
        code: "VALIDATION_ERROR",
        status: 400,
      };
    }
  }

  let launchChannelPartnerId: string | null = null;
  let microFranchisePartnerId: string | null = null;
  const referralRaw = input.referralPhone?.trim() || null;
  const normalizedPhone = referralRaw ? normalizeMicroFranchisePhone(referralRaw) : "";
  /** Persist digits when we have any, else raw (launch-channel path may use non-digit formats). */
  let referralPhoneForCompany: string | null = null;
  if (normalizedPhone.length > 0) {
    referralPhoneForCompany = normalizedPhone;
  } else if (referralRaw && referralRaw.length > 0) {
    referralPhoneForCompany = referralRaw;
  }

  if (referralRaw && normalizedPhone.length > 0) {
    const partner = await prisma.microFranchisePartner.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true },
    });
    if (partner) {
      microFranchisePartnerId = partner.id;
    } else {
      const launchPartner = await prisma.launchChannelPartner.upsert({
        where: { phone: referralRaw },
        create: { phone: referralRaw },
        update: {},
        select: { id: true },
      });
      launchChannelPartnerId = launchPartner.id;
    }
  }

  const businessType = industryToBusinessType(input.industry);
  const plan =
    input.industry === "CUSTOM" && input.customWorkspacePlan
      ? input.customWorkspacePlan
      : industryToPlan(input.industry);
  const prismaIndustry: CompanyIndustry =
    input.industry === "CUSTOM" ? CompanyIndustry.CUSTOM : CompanyIndustry.SOLAR;

  try {
    const owner = await prisma.user.findUnique({
      where: { id: input.ownerUserId },
      select: { name: true, email: true },
    });
    if (!owner) {
      return { ok: false, error: "Owner user not found", code: "SERVER_ERROR", status: 500 };
    }

    /** Empty team → minimal ICECONNECT-ready row (boss stays sole company ADMIN user). */
    const teamForPlan: NexaMappedMember[] =
      input.team.length > 0
        ? input.team
        : mapRoles([
            {
              name: owner.name.trim() || "Workspace",
              roleRaw: "admin",
            },
          ]);

    const onboardingPlan = buildOnboardingPlan({
      companyName: name,
      industry: input.industry,
      team: teamForPlan,
    });

    /** Default Prisma interactive tx is 5s; bcrypt + several employees exceeds that on dev / high-latency DB. */
    const interactiveTxTimeoutMs = (() => {
      const n = Number(process.env.ONBOARDING_LAUNCH_TX_TIMEOUT_MS);
      return Number.isFinite(n) ? Math.min(600_000, Math.max(15_000, n)) : 180_000;
    })();

    const txResult = await prisma.$transaction(
      async (tx) => {
      const employeeCredentials: LaunchCredential[] = [];
      let employeesProvisioned = 0;
      const rolesForDashboards: UserRole[] = [];
      const companyData = {
        name,
        ownerId: input.ownerUserId,
        industry: prismaIndustry,
        businessType,
        plan,
        referralPhone: referralPhoneForCompany,
        launchChannelPartnerId,
        microFranchisePartnerId,
        ...(logoUrl != null ? { logoUrl } : {}),
        ...(p?.primaryColor?.trim() ? { primaryColor: p.primaryColor.trim() } : {}),
        ...(p?.secondaryColor?.trim() ? { secondaryColor: p.secondaryColor.trim() } : {}),
        ...(p?.companyEmail?.trim() ? { companyEmail: p.companyEmail.trim() } : {}),
        ...(p?.companyPhone?.trim() ? { companyPhone: p.companyPhone.trim() } : {}),
        ...(p?.billingAddress?.trim() ? { billingAddress: p.billingAddress.trim() } : {}),
        ...(p?.gstNumber?.trim() ? { gstNumber: p.gstNumber.trim().toUpperCase() } : {}),
        ...(p?.bankDetails?.trim() ? { bankDetails: p.bankDetails.trim() } : {}),
      };

      let co: { id: string; plan: CompanyPlan };
      if (businessType === CompanyBusinessType.CUSTOM) {
        const created = await tx.company.create({
          data: {
            ...companyData,
            trialStartDate: null,
            trialEndDate: null,
            isTrialActive: false,
            subscriptionStatus: CompanySubscriptionStatus.PAYMENT_PENDING,
          },
          select: { id: true, plan: true },
        });
        co = created;
      } else {
        const trialStartDate = new Date();
        const created = await tx.company.create({
          data: {
            ...companyData,
            trialStartDate,
            trialEndDate: trialEndDateFromStart(trialStartDate),
            isTrialActive: true,
            subscriptionStatus: CompanySubscriptionStatus.TRIAL,
          },
          select: { id: true, plan: true },
        });
        co = created;
      }

      await tx.userCompany.create({
        data: {
          userId: input.ownerUserId,
          companyId: co.id,
          role: companyMembershipClass(UserRole.ADMIN),
          jobRole: UserRole.ADMIN,
        },
      });

      const ownerEmailLower = owner.email.trim().toLowerCase();

      for (const member of onboardingPlan.employees) {
        const role = member.userRole;
        const provided = member.email?.trim().toLowerCase();

        if (provided && provided === ownerEmailLower) {
          continue;
        }

        if (provided) {
          const existing = await tx.user.findFirst({
            where: { email: { equals: provided, mode: "insensitive" } },
            select: { id: true, name: true, email: true },
          });
          if (existing) {
            if (existing.id === input.ownerUserId) {
              continue;
            }
            const already = await tx.userCompany.findUnique({
              where: {
                userId_companyId: { userId: existing.id, companyId: co.id },
              },
            });
            if (already) {
              continue;
            }
            await tx.userCompany.create({
              data: {
                userId: existing.id,
                companyId: co.id,
                role: companyMembershipClass(role),
                jobRole: role,
              },
            });
            employeesProvisioned += 1;
            rolesForDashboards.push(role);
            employeeCredentials.push({
              name: existing.name,
              role,
              email: existing.email,
              password: "— (existing account)",
              loginUrl: loginUrlForRole(role),
            });
            continue;
          }

          const plain = generatePassword(name, member.name);
          const user = await tx.user.create({
            data: {
              name: member.name.trim(),
              email: provided,
              password: await hashPassword(plain),
              isActive: true,
              workspaceActivatedAt: new Date(),
              firstLogin: true,
            },
            select: { id: true, name: true, email: true },
          });
          await tx.userCompany.create({
            data: {
              userId: user.id,
              companyId: co.id,
              role: companyMembershipClass(role),
              jobRole: role,
            },
          });
          employeesProvisioned += 1;
          rolesForDashboards.push(role);
          employeeCredentials.push({
            name: user.name,
            role,
            email: user.email,
            password: plain,
            loginUrl: loginUrlForRole(role),
          });
          continue;
        }

        const email = await uniqueEmail(generateEmail(name, member.name));
        const plain = generatePassword(name, member.name);
        const user = await tx.user.create({
          data: {
            name: member.name.trim(),
            email,
            password: await hashPassword(plain),
            isActive: true,
            workspaceActivatedAt: new Date(),
            firstLogin: true,
          },
          select: { id: true, name: true, email: true },
        });
        await tx.userCompany.create({
          data: {
            userId: user.id,
            companyId: co.id,
            role: companyMembershipClass(role),
            jobRole: role,
          },
        });
        employeesProvisioned += 1;
        rolesForDashboards.push(role);
        employeeCredentials.push({
          name: user.name,
          role,
          email: user.email,
          password: plain,
          loginUrl: loginUrlForRole(role),
        });
      }

      if (launchChannelPartnerId) {
        await tx.launchChannelPartner.update({
          where: { id: launchChannelPartnerId },
          data: { conversions: { increment: 1 } },
        });
      }

      if (onboardingPlan.requiresTech) {
        for (const roleName of onboardingPlan.unknownRoles) {
          await tx.techRequest.create({
            data: {
              roleName,
              companyId: co.id,
              status: "pending",
              description: `Unknown role from launch: ${roleName}`,
            },
          });
        }
      }

      if (input.sessionId) {
        await tx.onboardingSession.updateMany({
          where: { id: input.sessionId },
          data: { status: "launched" },
        });
      }

      return {
        companyId: co.id,
        employeesProvisioned,
        rolesForDashboards,
        employeeCredentials,
      };
      },
      { maxWait: 20_000, timeout: interactiveTxTimeoutMs },
    );

    const { companyId, employeesProvisioned, rolesForDashboards, employeeCredentials } = txResult;

    const credentials: LaunchCredential[] = [...employeeCredentials];
    credentials.unshift({
      name: owner.name,
      role: UserRole.ADMIN,
      email: owner.email,
      password: "— (use your existing BGOS password)",
      loginUrl: loginUrlForRole(UserRole.ADMIN),
    });

    try {
      await applyIndustryTemplate(companyId, prismaIndustry === CompanyIndustry.SOLAR ? "SOLAR" : "CUSTOM");
    } catch (e) {
      createLogger("onboarding-launch").error("applyIndustryTemplate failed", e, { companyId });
    }

    const employeesCreated = employeesProvisioned;
    const dashboardsAssigned = dashboardsAssignedFor(rolesForDashboards);

    const mems = await loadMembershipsForJwt(input.ownerUserId);
    const primary = mems[0]!;
    const jwtCompany = mems.find((m) => m.companyId === companyId) ?? primary;
    const workspaceReady = input.addingAnotherBusiness;

    const sessionJwt = signAccessToken({
      sub: input.ownerUserId,
      email: input.ownerEmail,
      role: jwtCompany.jobRole,
      companyId: jwtCompany.companyId,
      companyPlan: jwtCompany.plan,
      workspaceReady,
      memberships: mems,
      ...(isSuperBossEmail(input.ownerEmail) ? { superBoss: true as const } : {}),
    });

    const credentialsFile = {
      filename: `${name.replace(/\s+/g, "_")}_credentials.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: credentialsWorkbookBase64(credentials),
    };

    const pipeline =
      input.industry === "SOLAR" ? ["New", "Intro", "Demo", "Account", "Onboarding", "Live"] : [];

    const out: OnboardingLaunchOk = {
      ok: true,
      companyId,
      employeesCreated,
      dashboardsAssigned,
      credentials,
      credentialsFile,
      pipeline,
      onboardingPlan,
      sessionJwt,
      activeCompanyId: companyId,
      businessType,
    };
    if (businessType === CompanyBusinessType.CUSTOM) {
      out.requiresCustomPayment = true;
      out.nextStep = "/onboarding/custom/pay";
    }
    return out;
  } catch (e) {
    console.error("[onboarding-launch-engine]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Launch failed",
      code: "SERVER_ERROR",
      status: 500,
    };
  }
}
