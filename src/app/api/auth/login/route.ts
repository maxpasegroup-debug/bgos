import { CompanyPlan, EmployeeDomain, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { AUTH_ERROR_CODES, getAuthErrorMessage } from "@/lib/auth-api";
import { ensureDefaultBossUser } from "@/lib/bootstrap-default-boss";
import { checkLoginRateLimit, getClientIpForRateLimit } from "@/lib/login-rate-limit";
import { withDbRetry } from "@/lib/db-retry";
import { hostTenantFromHeader, type HostTenant } from "@/lib/host-routing";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signAccessToken } from "@/lib/jwt";
import { isBossReady } from "@/lib/boss-ready";
import {
  MICRO_FRANCHISE_HOME_PATH,
  postLoginDestination,
  SUPER_BOSS_HOME_PATH,
  TECH_EXEC_HOME_PATH,
} from "@/lib/role-routing";
import { BGOS_BOSS_READY_HOME, BGOS_ONBOARDING_ENTRY } from "@/lib/system-readiness";
import {
  applyProductionBossJwtMembershipOverrides,
  isBgosProductionBossBypassEmail,
} from "@/lib/bgos-production-boss-bypass";
import { setActiveCompanyCookie, setSessionCookie } from "@/lib/session-cookie";
import { isSuperBossEmail } from "@/lib/super-boss";
import { iceconnectRoleHomePath } from "@/lib/iceconnect-employee";
import { SOLAR_BOSS_HOME } from "@/lib/solar-boss-config";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const bodySchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  /** When true (e.g. API clients), return JSON instead of 303 redirect. */
  respondWithJson: z.boolean().optional(),
  /** Safe return path after sign-in (same-origin flows). */
  from: z.string().optional(),
});

function isBossRole(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

function crossDomainLoginRequired(hostHeader: string | null, role: UserRole): boolean {
  const tenant = hostTenantFromHeader(hostHeader);
  const boss = isBossRole(role);
  /** Field / exec roles sign in on bgos.online but work on iceconnect.in (separate host cookie). */
  if (tenant === "bgos" && !boss) return true;
  return false;
}

/**
 * Post-login path: boss + company + activated workspace ⇒ control home; else Nexa or role home.
 */
function internalPostLoginLocation(
  role: UserRole,
  from: string | null | undefined,
  companyId: string | null,
  workspaceActivated: boolean,
  userEmail: string,
  employeeDomain: EmployeeDomain | null | undefined,
): string {
  if (isSuperBossEmail(userEmail)) {
    return SUPER_BOSS_HOME_PATH;
  }
  if (role === UserRole.TECH_EXECUTIVE) {
    return TECH_EXEC_HOME_PATH;
  }
  if (role === UserRole.MICRO_FRANCHISE) {
    return MICRO_FRANCHISE_HOME_PATH;
  }
  if (isBossReady(role, companyId)) {
    if (
      workspaceActivated &&
      role === UserRole.ADMIN &&
      employeeDomain === EmployeeDomain.SOLAR
    ) {
      return companyId && companyId.length > 0
        ? `${SOLAR_BOSS_HOME}?company_id=${encodeURIComponent(companyId)}`
        : SOLAR_BOSS_HOME;
    }
    return workspaceActivated ? BGOS_BOSS_READY_HOME : BGOS_ONBOARDING_ENTRY;
  }
  if (companyId == null || companyId === "") {
    return BGOS_ONBOARDING_ENTRY;
  }
  if (!workspaceActivated) {
    return BGOS_ONBOARDING_ENTRY;
  }
  return postLoginDestination(String(role), from?.trim() ?? null);
}

export async function POST(request: Request) {
  try {
    const ip = getClientIpForRateLimit(request);
    const limited = checkLoginRateLimit(ip);
    if (!limited.ok) {
      return NextResponse.json(
        {
          success: false as const,
          ok: false as const,
          error: "Too many login attempts. Please wait and try again.",
          code: "RATE_LIMITED" as const,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      );
    }

    const raw = await parseJsonBody(request);
    if (!raw.ok) return raw.response;

    const parsed = bodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return zodValidationErrorResponse(parsed.error);
    }

    const { password, email: emailRaw } = parsed.data;
    const email = emailRaw.trim();

    await ensureDefaultBossUser();

    const user = await withDbRetry("auth/login.findUser", () =>
      prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        include: {
          memberships: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  plan: true,
                  trialEndDate: true,
                  subscriptionPeriodEnd: true,
                  subscriptionStatus: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
    );

    const invalidPasswordResponse = NextResponse.json(
      {
        success: false as const,
        ok: false as const,
        error: getAuthErrorMessage(AUTH_ERROR_CODES.INVALID_PASSWORD),
        code: AUTH_ERROR_CODES.INVALID_PASSWORD,
      },
      { status: 401 },
    );

    if (!user) {
      return NextResponse.json(
        {
          success: false as const,
          ok: false as const,
          error: getAuthErrorMessage(AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND),
          code: AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND,
        },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false as const,
          ok: false as const,
          error: "Your account is inactive. Contact your administrator.",
          code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        },
        { status: 403 },
      );
    }

    if (!IS_PRODUCTION) {
      console.info("[auth/login] Before password check", {
        userId: user.id,
        hasMembership: user.memberships.length > 0,
      });
    }
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return invalidPasswordResponse;
    }

    const membership = user.memberships[0];
    let companyPlan: CompanyPlan;
    let companyId: string | null;
    let sessionRole: UserRole;
    let needsOnboarding: boolean;

    if (!membership) {
      const tenant: HostTenant = hostTenantFromHeader(request.headers.get("host"));
      if (tenant === "ice") {
        return NextResponse.json(
          {
            success: false as const,
            ok: false as const,
            error: "No company is assigned to your account. Contact your administrator.",
            code: "CONTACT_ADMIN" as const,
          },
          { status: 403 },
        );
      }
      companyPlan = CompanyPlan.BASIC;
      companyId = null;
      sessionRole = UserRole.ADMIN;
      needsOnboarding = true;
    } else {
      if (!membership.company) {
        return NextResponse.json(
          {
            success: false as const,
            ok: false as const,
            error: "Your company record is missing. Contact your administrator.",
            code: "CONTACT_ADMIN" as const,
          },
          { status: 403 },
        );
      }
      companyPlan = membership.company.plan ?? CompanyPlan.BASIC;
      companyId = membership.companyId;
      sessionRole = membership.jobRole;
      needsOnboarding = false;
    }

    const memsRaw = !membership
      ? []
      : user.memberships.map((m) => ({
          companyId: m.companyId,
          plan: m.company.plan,
          jobRole: m.jobRole,
          trialEndsAt: m.company.trialEndDate?.toISOString() ?? null,
          subscriptionPeriodEnd: m.company.subscriptionPeriodEnd?.toISOString() ?? null,
          subscriptionStatus: m.company.subscriptionStatus,
        }));
    const mems = applyProductionBossJwtMembershipOverrides(user.email, memsRaw);
    const primary = mems[0];
    const effectiveRole = primary?.jobRole ?? sessionRole;
    const productionBossBypass = isBgosProductionBossBypassEmail(user.email);
    const jwtCompanyPlan =
      productionBossBypass && primary
        ? CompanyPlan.PRO
        : (primary?.plan ?? companyPlan);

    // JWT creation
    const boss = isSuperBossEmail(user.email);

    const loginHostTenant = hostTenantFromHeader(request.headers.get("host"));
    if (loginHostTenant === "ice" && effectiveRole === UserRole.ADMIN && !boss) {
      return NextResponse.json(
        {
          success: false as const,
          ok: false as const,
          error: "Boss accounts sign in at bgos.online.",
          code: "WRONG_HOST" as const,
        },
        { status: 403 },
      );
    }
    /** Explicit BGOS-only identity cannot use ICECONNECT host. */
    if (loginHostTenant === "ice" && user.employeeSystem === "BGOS") {
      return NextResponse.json(
        {
          success: false as const,
          ok: false as const,
          error: "This account is registered for BGOS only. Sign in at bgos.online.",
          code: "WRONG_HOST" as const,
        },
        { status: 403 },
      );
    }

    const resolvedCompanyId = primary?.companyId ?? companyId;
    let workspaceActivatedAt = user.workspaceActivatedAt;
    if (
      loginHostTenant !== "ice" &&
      isBossReady(effectiveRole, resolvedCompanyId) &&
      !workspaceActivatedAt
    ) {
      await prisma.user.update({
        where: { id: user.id },
        data: { workspaceActivatedAt: new Date() },
      });
      workspaceActivatedAt = new Date();
    }
    const workspaceActivated = Boolean(workspaceActivatedAt);
    const workspaceReady = needsOnboarding ? false : workspaceActivated;

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: effectiveRole,
      companyId: resolvedCompanyId,
      companyPlan: jwtCompanyPlan,
      workspaceReady,
      ...(mems.length ? { memberships: mems } : {}),
      ...(boss ? { superBoss: true as const } : {}),
      ...(user.employeeSystem ? { employeeSystem: user.employeeSystem } : {}),
      ...(user.employeeDomain ? { employeeDomain: user.employeeDomain } : {}),
      ...(user.iceconnectEmployeeRole
        ? { iceconnectEmployeeRole: user.iceconnectEmployeeRole }
        : {}),
    });

    const companiesPayload =
      user.memberships?.map((m) => ({
        companyId: m.companyId,
        name: m.company?.name ?? "Company",
        jobRole: m.jobRole,
      })) ?? [];

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: effectiveRole,
      companyId: resolvedCompanyId,
      companyPlan: productionBossBypass && resolvedCompanyId ? CompanyPlan.PRO : companyPlan,
      ...(needsOnboarding
        ? { needsOnboarding: true as const }
        : {
            workspaceReady: workspaceReady as boolean,
            ...(!workspaceReady ? { needsWorkspaceActivation: true as const } : {}),
          }),
    };

    if (!IS_PRODUCTION) {
      console.info("[auth/login] session-routing", {
        userId: user.id,
        email: user.email,
        sessionRole,
        effectiveRole,
        companyId,
        membershipCount: user.memberships.length,
        needsOnboarding,
        workspaceActivatedAt: workspaceActivatedAt?.toISOString() ?? null,
        isSuperBoss: boss,
        companyPlan,
      });
    }

    const hostHeader = request.headers.get("host");
    const needsCrossDomainHandoff = crossDomainLoginRequired(hostHeader, effectiveRole);
    const forcePasswordReset = user.firstLogin === true || user.forcePasswordReset === true;
    const inProgressSession = await prisma.onboardingSession.findFirst({
      where: {
        createdByUserId: user.id,
        status: { in: ["draft", "in_progress", "ready"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const iceHome =
      loginHostTenant === "ice" &&
      user.employeeSystem === "ICECONNECT" &&
      user.iceconnectEmployeeRole
        ? iceconnectRoleHomePath(user.iceconnectEmployeeRole)
        : null;

    const nextPath = boss
      ? SUPER_BOSS_HOME_PATH
      : iceHome
        ? iceHome
        : effectiveRole === UserRole.TECH_EXECUTIVE
          ? TECH_EXEC_HOME_PATH
          : effectiveRole === UserRole.MICRO_FRANCHISE
            ? MICRO_FRANCHISE_HOME_PATH
            : internalPostLoginLocation(
                  effectiveRole,
                  parsed.data.from?.trim() || undefined,
                  resolvedCompanyId,
                  workspaceActivated,
                  user.email,
                  user.employeeDomain,
                );
    const forcedNextPath = forcePasswordReset
      ? "/reset-password"
      : inProgressSession
        ? `${BGOS_ONBOARDING_ENTRY}?resume=1`
        : nextPath;

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Cookie setting — structured body: { success, user } plus fields used by existing clients.
    const res = NextResponse.json(
      {
        success: true as const,
        user: userPayload,
        ok: true as const,
        companies: companiesPayload,
        needsCompanySelection: boss ? false : companiesPayload.length > 1,
        needsCrossDomainHandoff,
        nextPath: forcedNextPath,
        isSuperBoss: boss,
        firstLogin: forcePasswordReset,
        ...(forcePasswordReset ? { code: "FORCE_PASSWORD_RESET" as const } : {}),
      },
      { status: 200 },
    );
    await setSessionCookie(res, token);
    if (resolvedCompanyId) {
      await setActiveCompanyCookie(res, resolvedCompanyId);
    }
    if (!IS_PRODUCTION) {
      console.info("[auth/login] response", {
        userId: user.id,
        nextPath: forcedNextPath,
        needsCrossDomainHandoff,
        userPayloadRole: userPayload.role,
        userPayloadCompanyId: userPayload.companyId,
        userPayloadKeys: Object.keys(userPayload),
      });
    }
    return res;
  } catch (e) {
    console.error("[auth/login] Unhandled error", e);
    const jwtHint =
      e instanceof Error && /sign|token|jwt|secret/i.test(e.message)
        ? "Authentication is not configured (check JWT_SECRET)."
        : "Could not complete sign-in. Try again.";
    return NextResponse.json(
      {
        success: false as const,
        ok: false as const,
        error: jwtHint,
        code: "SERVER_ERROR" as const,
      },
      { status: 500 },
    );
  }
}
