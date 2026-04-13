import { CompanyPlan, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { AUTH_ERROR_CODES } from "@/lib/auth-api";
import { checkLoginRateLimit, getClientIpForRateLimit } from "@/lib/login-rate-limit";
import { hostTenantFromHeader, type HostTenant } from "@/lib/host-routing";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signAccessToken } from "@/lib/jwt";
import { postLoginDestination } from "@/lib/role-routing";
import {
  applyProductionBossJwtMembershipOverrides,
  isBgosProductionBossBypassEmail,
} from "@/lib/bgos-production-boss-bypass";
import { setActiveCompanyCookie, setSessionCookie } from "@/lib/session-cookie";
import { isSuperBossEmail } from "@/lib/super-boss";

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

/** Resolve same-origin path after login (cookies are set on this response). */
function internalPostLoginLocation(
  role: UserRole,
  from: string | null | undefined,
  needsOnboardingFlow: boolean,
  companyId: string | null,
  workspaceActivated: boolean,
  userEmail: string,
): string {
  if (isSuperBossEmail(userEmail)) {
    return "/bgos/control";
  }
  if (needsOnboardingFlow || companyId == null || !workspaceActivated) {
    return "/onboarding";
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

    const user = await prisma.user.findFirst({
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
    });

    const authError = NextResponse.json(
      {
        success: false as const,
        ok: false as const,
        error: "Invalid email or password",
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      },
      { status: 401 },
    );

    if (!user) {
      return authError;
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

    console.info("[auth/login] Before password check", {
      userId: user.id,
      hasMembership: user.memberships.length > 0,
    });
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return authError;
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

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: effectiveRole,
      companyId: primary?.companyId ?? companyId,
      companyPlan: jwtCompanyPlan,
      workspaceReady: needsOnboarding
        ? false
        : Boolean(user.workspaceActivatedAt),
      ...(mems.length ? { memberships: mems } : {}),
      ...(boss ? { superBoss: true as const } : {}),
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
      companyId,
      companyPlan: productionBossBypass && companyId ? CompanyPlan.PRO : companyPlan,
      ...(needsOnboarding
        ? { needsOnboarding: true as const }
        : {
            workspaceReady: Boolean(user.workspaceActivatedAt),
            ...(user.workspaceActivatedAt
              ? {}
              : { needsWorkspaceActivation: true as const }),
          }),
    };

    console.info("[auth/login] After success", {
      userId: user.id,
      companyId,
      role: sessionRole,
      plan: companyPlan,
    });

    const hostHeader = request.headers.get("host");
    const needsCrossDomainHandoff = crossDomainLoginRequired(hostHeader, effectiveRole);
    const nextPath = internalPostLoginLocation(
      effectiveRole,
      parsed.data.from?.trim() || undefined,
      needsOnboarding,
      companyId,
      Boolean(user.workspaceActivatedAt),
      user.email,
    );

    // Cookie setting
    const res = NextResponse.json({
      success: true as const,
      ok: true as const,
      user: userPayload,
      companies: companiesPayload,
      needsCompanySelection: boss ? false : companiesPayload.length > 1,
      needsCrossDomainHandoff,
      nextPath,
      isSuperBoss: boss,
    });
    setSessionCookie(res, token);
    if (companyId) {
      setActiveCompanyCookie(res, companyId);
    }
    console.info("[auth/login] Before response", {
      userId: user.id,
      nextPath,
      needsCrossDomainHandoff,
    });
    return res;
  } catch (e) {
    console.error("[auth/login] Unhandled error", e);
    if (e instanceof Error && /sign|token|jwt/i.test(e.message)) {
      return NextResponse.json(
        {
          success: false as const,
          ok: false as const,
          error: "Authentication is not configured",
          code: "SERVER_ERROR",
        },
        { status: 500 },
      );
    }
    const handled = handleApiError("POST /api/auth/login", e);
    // Ensure a JSON body shape for clients.
    return handled;
  }
}
