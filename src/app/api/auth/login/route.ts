import { CompanyPlan, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { AUTH_ERROR_CODES } from "@/lib/auth-api";
import { checkLoginRateLimit, getClientIpForRateLimit } from "@/lib/login-rate-limit";
import { hostTenantFromHeader } from "@/lib/host-routing";
import { mobileLookupVariants } from "@/lib/mobile-login";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signAccessToken } from "@/lib/jwt";
import { roleCanAccessPath } from "@/lib/role-routing";
import { setActiveCompanyCookie, setSessionCookie } from "@/lib/session-cookie";

const bodySchema = z
  .object({
    email: z.string().optional(),
    mobile: z.string().optional(),
    password: z.string().min(1, "Password is required"),
    /** When true (e.g. API clients), return JSON instead of 303 redirect. */
    respondWithJson: z.boolean().optional(),
    /** Safe return path after sign-in (same-origin flows). */
    from: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const email = data.email?.trim();
    const mobile = data.mobile?.trim();
    if (email && mobile) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Use either email or mobile",
      });
    }
    if (!email && !mobile) {
      ctx.addIssue({
        code: "custom",
        path: ["mobile"],
        message: "Mobile number or email is required",
      });
    }
    if (email && !z.string().email().safeParse(email).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Enter a valid email",
      });
    }
  });

function isBossRole(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.MANAGER;
}

function crossDomainLoginRequired(hostHeader: string | null, role: UserRole): boolean {
  const tenant = hostTenantFromHeader(hostHeader);
  const boss = isBossRole(role);
  if (tenant === "bgos" && !boss) return true;
  if (tenant === "ice" && boss) return true;
  return false;
}

/** Resolve same-origin Location after login (cookies are set on this response before redirect). */
function internalPostLoginLocation(
  role: UserRole,
  from: string | null | undefined,
  needsOnboardingFlow: boolean,
  companyId: string | null,
  workspaceActivated: boolean,
): string {
  if (needsOnboardingFlow || companyId == null || !workspaceActivated) {
    return "/onboarding";
  }
  const safeFrom =
    from && from.startsWith("/") && roleCanAccessPath(role, from) ? from : null;
  if (safeFrom) return safeFrom;
  if (role === UserRole.ADMIN) return "/bgos";
  return "/iceconnect";
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

    const { password } = parsed.data;
    const email = parsed.data.email?.trim();
    const mobileRaw = parsed.data.mobile?.trim();

    let user;
    if (email) {
      user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        include: {
          memberships: {
            include: {
              company: {
                select: { id: true, plan: true, trialEndDate: true, subscriptionPeriodEnd: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    } else {
      const variants = mobileLookupVariants(mobileRaw ?? "");
      if (variants.length === 0) {
        return NextResponse.json(
          {
            success: false as const,
            ok: false as const,
            error: "Enter a valid mobile number",
            code: "VALIDATION_ERROR",
          },
          { status: 400 },
        );
      }
      user = await prisma.user.findFirst({
        where: {
          OR: variants.map((m) => ({
            mobile: { equals: m, mode: "insensitive" as const },
          })),
        },
        include: {
          memberships: {
            include: {
              company: {
                select: { id: true, plan: true, trialEndDate: true, subscriptionPeriodEnd: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    }

    const authError = NextResponse.json(
      {
        success: false as const,
        ok: false as const,
        error: email
          ? "Invalid email or password"
          : "Invalid mobile number or password",
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      },
      { status: 401 },
    );

    if (!user || !user.isActive) {
      return authError;
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
      if (!email) {
        return NextResponse.json(
          {
            success: false as const,
            ok: false as const,
            error: "No company access for this account",
            code: "NO_MEMBERSHIP",
          },
          { status: 403 },
        );
      }
      companyPlan = CompanyPlan.BASIC;
      companyId = null;
      sessionRole = UserRole.ADMIN;
      needsOnboarding = true;
    } else {
      companyPlan = membership.company?.plan ?? CompanyPlan.BASIC;
      companyId = membership.companyId;
      sessionRole = membership.jobRole;
      needsOnboarding = false;
    }

    const mems = !membership
      ? []
      : user.memberships.map((m) => ({
          companyId: m.companyId,
          plan: m.company.plan,
          jobRole: m.jobRole,
          trialEndsAt: m.company.trialEndDate?.toISOString() ?? null,
          subscriptionPeriodEnd: m.company.subscriptionPeriodEnd?.toISOString() ?? null,
        }));
    const primary = mems[0];

    // JWT creation
    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: primary?.jobRole ?? sessionRole,
      companyId: primary?.companyId ?? companyId,
      companyPlan: primary?.plan ?? companyPlan,
      workspaceReady: needsOnboarding
        ? false
        : Boolean(user.workspaceActivatedAt),
      ...(mems.length ? { memberships: mems } : {}),
    });

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: sessionRole,
      companyId,
      companyPlan,
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
    const needsCrossDomainHandoff = crossDomainLoginRequired(hostHeader, sessionRole);
    const nextPath = internalPostLoginLocation(
      sessionRole,
      parsed.data.from?.trim() || undefined,
      needsOnboarding,
      companyId,
      Boolean(user.workspaceActivatedAt),
    );

    // Cookie setting
    const res = NextResponse.json({
      success: true as const,
      ok: true as const,
      user: userPayload,
      needsCrossDomainHandoff,
      nextPath,
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
