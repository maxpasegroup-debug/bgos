import "server-only";

import {
  CompanyBusinessType,
  CompanyIndustry,
  CompanyPlan,
  CompanySubscriptionStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import {
  credentialsWorkbookBase64,
  generateEmail,
  industryToBusinessType,
  industryToPlan,
  type LaunchCredential,
  type LaunchIndustry,
} from "@/lib/company-launch-engine";
import { applyIndustryTemplateWithClient } from "@/lib/industry-templates-core";
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
import { mapTeamEntries } from "@/lib/nexa-onboarding-engine";
import { sendAccountReadyEmail } from "@/lib/account-ready-email";
import { BGOS_BOSS_READY_HOME } from "@/lib/system-readiness";

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

export type OnboardingLaunchStepFailed =
  | "validation"
  | "company_creation"
  | "role_assignment"
  | "industry_template"
  | "nexa_session"
  | "session_mint"
  | "unknown";

export type OnboardingLaunchFail = {
  ok: false;
  error: string;
  code: "VALIDATION_ERROR" | "FORBIDDEN" | "SERVER_ERROR";
  status?: number;
  step_failed?: OnboardingLaunchStepFailed;
};

export type OnboardingLaunchResult = OnboardingLaunchOk | OnboardingLaunchFail;

async function rollbackCommittedLaunch(
  companyId: string,
  newEmployeeUserIds: string[],
  sessionId: string | null | undefined,
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      if (sessionId) {
        await tx.onboardingSession.updateMany({
          where: { id: sessionId },
          data: { status: "in_progress" },
        });
      }
      await tx.company.delete({ where: { id: companyId } });
    });
    for (const uid of newEmployeeUserIds) {
      const n = await prisma.userCompany.count({ where: { userId: uid } });
      if (n === 0) {
        await prisma.user.delete({ where: { id: uid } }).catch(() => undefined);
      }
    }
  } catch (e) {
    createLogger("onboarding-launch").error("rollbackCommittedLaunch failed", e, { companyId });
  }
}

function failFromPrismaOrUnknown(e: unknown): OnboardingLaunchFail {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      return {
        ok: false,
        error: "A record already exists for this setup. Use Retry Setup to continue.",
        code: "SERVER_ERROR",
        status: 409,
        step_failed: "role_assignment",
      };
    }
    if (e.code === "P2021" || e.code === "P2022" || e.code === "P2010") {
      return {
        ok: false,
        error: "System setup issue. Please retry in a moment.",
        code: "SERVER_ERROR",
        status: 503,
        step_failed: "industry_template",
      };
    }
  }
  const msg = e instanceof Error ? e.message : "Launch failed";
  if (/invalid enum|does not exist|IceconnectMetroStage|Unknown arg|column/i.test(msg)) {
    return {
      ok: false,
      error: "System setup issue. Please retry in a moment.",
      code: "SERVER_ERROR",
      status: 503,
      step_failed: "company_creation",
    };
  }
  return {
    ok: false,
    error: msg,
    code: "SERVER_ERROR",
    status: 500,
    step_failed: "company_creation",
  };
}

function buildTempPassword(companyName: string, personName: string): string {
  const c = companyName.trim().replace(/\s+/g, "-").slice(0, 24) || "Company";
  const p = personName.trim().replace(/\s+/g, "-").slice(0, 24) || "User";
  return `${c}-${p}-2026`;
}

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
  const set = new Set<string>([BGOS_BOSS_READY_HOME]);
  for (const r of employeeJobRoles) {
    set.add(getRoleHome(r));
  }
  return [...set].sort();
}

export async function runOnboardingLaunch(input: RunOnboardingLaunchInput): Promise<OnboardingLaunchResult> {
  const name = input.companyName.trim();
  if (!name) {
    return {
      ok: false,
      error: "Company name is required",
      code: "VALIDATION_ERROR",
      status: 400,
      step_failed: "validation",
    };
  }

  const existingByOwnerAndName = await prisma.company.findFirst({
    where: { ownerId: input.ownerUserId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
    if (existingByOwnerAndName) {
    try {
      const ownerRow = await prisma.user.findUnique({
        where: { id: input.ownerUserId },
        select: { name: true, email: true, workspaceActivatedAt: true },
      });
      const mems = await loadMembershipsForJwt(input.ownerUserId);
      const primary = mems[0]!;
      const jwtCompany = mems.find((m) => m.companyId === existingByOwnerAndName.id) ?? primary;
      const workspaceReady =
        input.addingAnotherBusiness || Boolean(ownerRow?.workspaceActivatedAt);
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
        dashboardsAssigned: [BGOS_BOSS_READY_HOME],
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
      return {
        ok: false,
        error: "Authentication is not configured",
        code: "SERVER_ERROR",
        status: 500,
        step_failed: "session_mint",
      };
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
        step_failed: "validation",
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
    const phoneCandidates =
      normalizedPhone.length === 10
        ? [normalizedPhone, `91${normalizedPhone}`]
        : [normalizedPhone];
    const partner = await prisma.microFranchisePartner.findFirst({
      where: { phone: { in: phoneCandidates } },
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
      return {
        ok: false,
        error: "Owner user not found",
        code: "SERVER_ERROR",
        status: 500,
        step_failed: "unknown",
      };
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
    const roleStatusByName = new Map(
      mapTeamEntries(onboardingPlan.employees.map((e) => ({ name: e.name, role: e.roleRaw }))).map((e) => [
        e.name.trim().toLowerCase(),
        e,
      ]),
    );

    const ownerEmailLower = owner.email.trim().toLowerCase();
    const preparedUsersByProvidedEmail = new Map<
      string,
      { plain: string; passwordHash: string }
    >();
    const generatedCandidates = onboardingPlan.employees.filter((member) => {
      const provided = member.email?.trim().toLowerCase();
      return !provided;
    });
    const preparedGeneratedUsers = await Promise.all(
      generatedCandidates.map(async (member) => {
        const email = await uniqueEmail(generateEmail(name, member.name));
        const plain = buildTempPassword(name, member.name);
        return {
          name: member.name.trim(),
          role: member.userRole,
          email,
          plain,
          passwordHash: await hashPassword(plain),
        };
      }),
    );
    for (const member of onboardingPlan.employees) {
      const provided = member.email?.trim().toLowerCase();
      if (!provided || provided === ownerEmailLower || preparedUsersByProvidedEmail.has(provided)) {
        continue;
      }
      const plain = buildTempPassword(name, member.name);
      preparedUsersByProvidedEmail.set(provided, {
        plain,
        passwordHash: await hashPassword(plain),
      });
    }

    console.time("ONBOARDING_TX");
    const txResult = await prisma.$transaction(
      async (tx) => {
      const createdEmployeeUserIds: string[] = [];
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
          dashboardAssigned: "Manager",
          status: "READY",
        },
      });

      const preparedGeneratedByRole = new Map<
        string,
        { name: string; role: UserRole; email: string; plain: string; passwordHash: string }
      >(
        preparedGeneratedUsers.map((u) => [`${u.role}:${u.name.toLowerCase()}`, u]),
      );

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
              const mapped = roleStatusByName.get(member.name.trim().toLowerCase());
              await tx.userCompany.update({
                where: { id: already.id },
                data: {
                  role: companyMembershipClass(role),
                  jobRole: role,
                  dashboardAssigned: mapped?.mappedDashboard ?? null,
                  status: mapped?.status ?? "READY",
                },
              });
              continue;
            }
            const mapped = roleStatusByName.get(member.name.trim().toLowerCase());
            await tx.userCompany.create({
              data: {
                userId: existing.id,
                companyId: co.id,
                role: companyMembershipClass(role),
                jobRole: role,
                dashboardAssigned: mapped?.mappedDashboard ?? null,
                status: mapped?.status ?? "READY",
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

          const preparedProvided = preparedUsersByProvidedEmail.get(provided);
          if (!preparedProvided) {
            continue;
          }
          const user = await tx.user.create({
            data: {
              name: member.name.trim(),
              email: provided,
              password: preparedProvided.passwordHash,
              isActive: true,
              workspaceActivatedAt: new Date(),
              firstLogin: true,
              forcePasswordReset: true,
            },
            select: { id: true, name: true, email: true },
          });
          createdEmployeeUserIds.push(user.id);
          const mapped = roleStatusByName.get(member.name.trim().toLowerCase());
          await tx.userCompany.create({
            data: {
              userId: user.id,
              companyId: co.id,
              role: companyMembershipClass(role),
              jobRole: role,
              dashboardAssigned: mapped?.mappedDashboard ?? null,
              status: mapped?.status ?? "READY",
            },
          });
          employeesProvisioned += 1;
          rolesForDashboards.push(role);
          employeeCredentials.push({
            name: user.name,
            role,
            email: user.email,
            password: preparedProvided.plain,
            loginUrl: loginUrlForRole(role),
          });
          continue;
        }

        const prepared = preparedGeneratedByRole.get(`${role}:${member.name.trim().toLowerCase()}`);
        if (!prepared) {
          continue;
        }
        const user = await tx.user.create({
          data: {
            name: prepared.name,
            email: prepared.email,
            password: prepared.passwordHash,
            isActive: true,
            workspaceActivatedAt: new Date(),
            firstLogin: true,
            forcePasswordReset: true,
          },
          select: { id: true, name: true, email: true },
        });
        createdEmployeeUserIds.push(user.id);
        const mapped = roleStatusByName.get(member.name.trim().toLowerCase());
        await tx.userCompany.create({
          data: {
            userId: user.id,
            companyId: co.id,
            role: companyMembershipClass(role),
            jobRole: role,
            dashboardAssigned: mapped?.mappedDashboard ?? null,
            status: mapped?.status ?? "READY",
          },
        });
        employeesProvisioned += 1;
        rolesForDashboards.push(role);
        employeeCredentials.push({
          name: user.name,
          role,
          email: user.email,
          password: prepared.plain,
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

      /** Readymade / trial workspace: owner can use BGOS immediately (Nexa → control home). Custom PAYMENT_PENDING stays on payment / building shell. */
      if (businessType !== CompanyBusinessType.CUSTOM) {
        await tx.user.update({
          where: { id: input.ownerUserId },
          data: { workspaceActivatedAt: new Date() },
        });
      }

      await applyIndustryTemplateWithClient(
        tx,
        co.id,
        prismaIndustry === CompanyIndustry.SOLAR ? "SOLAR" : "CUSTOM",
      );

      return {
        companyId: co.id,
        employeesProvisioned,
        rolesForDashboards,
        employeeCredentials,
        createdEmployeeUserIds,
      };
      },
      { timeout: 20_000 },
    );
    console.timeEnd("ONBOARDING_TX");

    const { companyId, employeesProvisioned, rolesForDashboards, employeeCredentials, createdEmployeeUserIds } =
      txResult;

    const credentials: LaunchCredential[] = [...employeeCredentials];
    credentials.unshift({
      name: owner.name,
      role: UserRole.ADMIN,
      email: owner.email,
      password: "— (use your existing BGOS password)",
      loginUrl: loginUrlForRole(UserRole.ADMIN),
    });

    const employeesCreated = employeesProvisioned;
    const dashboardsAssigned = dashboardsAssignedFor(rolesForDashboards);

    await Promise.all(
      credentials
        .filter((c) => c.password && !c.password.startsWith("—"))
        .map((c) =>
          sendAccountReadyEmail({
            to: c.email,
            companyName: name,
            loginUrl: c.loginUrl,
            tempPassword: c.password,
          }),
        ),
    );

    const mems = await loadMembershipsForJwt(input.ownerUserId);
    const primary = mems[0]!;
    const jwtCompany = mems.find((m) => m.companyId === companyId) ?? primary;
    const ownerForJwt = await prisma.user.findUnique({
      where: { id: input.ownerUserId },
      select: { workspaceActivatedAt: true },
    });
    const workspaceReady =
      input.addingAnotherBusiness || Boolean(ownerForJwt?.workspaceActivatedAt);

    let sessionJwt: string;
    try {
      sessionJwt = signAccessToken({
        sub: input.ownerUserId,
        email: input.ownerEmail,
        role: jwtCompany.jobRole,
        companyId: jwtCompany.companyId,
        companyPlan: jwtCompany.plan,
        workspaceReady,
        memberships: mems,
        ...(isSuperBossEmail(input.ownerEmail) ? { superBoss: true as const } : {}),
      });
    } catch (e) {
      createLogger("onboarding-launch").error("signAccessToken failed after launch tx", e, { companyId });
      await rollbackCommittedLaunch(companyId, createdEmployeeUserIds, input.sessionId);
      return {
        ok: false,
        error: "Authentication is not configured",
        code: "SERVER_ERROR",
        status: 500,
        step_failed: "session_mint",
      };
    }

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
    return failFromPrismaOrUnknown(e);
  }
}
