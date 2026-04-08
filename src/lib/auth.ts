import "server-only";

import { CompanyPlan, type UserRole } from "@prisma/client";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { AccessTokenPayload } from "@/types";
import { parseJwtMemberships } from "./auth-active-company";
import {
  AUTH_COOKIE_NAME,
  AUTH_HEADER_COMPANY_ID,
  AUTH_HEADER_COMPANY_PLAN,
  AUTH_HEADER_NEEDS_COMPANY,
  AUTH_HEADER_USER_EMAIL,
  AUTH_HEADER_USER_ID,
  AUTH_HEADER_USER_ROLE,
  AUTH_HEADER_WORKSPACE_READY,
  companyPlanFromJwtClaim,
} from "./auth-config";
import { verifyAccessTokenResult } from "./jwt";
import { isPlanLockedToBasic } from "./plan-production-lock";
import { prisma } from "./prisma";

export type AuthUser = AccessTokenPayload;

export function membershipCompanyIds(user: AuthUser): string[] {
  if (user.memberships?.length) return user.memberships.map((m) => m.companyId);
  return user.companyId ? [user.companyId] : [];
}

function readBearer(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

/**
 * JWT from cookie (browser) or Authorization: Bearer (API clients).
 */
export function getTokenFromRequest(request: NextRequest | Request): string | null {
  if ("cookies" in request && typeof request.cookies?.get === "function") {
    const fromCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (fromCookie) return fromCookie;
  }
  return readBearer(request);
}

function payloadToUser(decoded: Record<string, unknown>): AuthUser | null {
  const sub = decoded.sub;
  const email = decoded.email;
  const role = decoded.role;
  const companyIdRaw = decoded.companyId;
  if (typeof sub !== "string" || !sub) return null;
  if (typeof email !== "string" || !email) return null;
  if (typeof role !== "string" || !role) return null;
  const companyId =
    companyIdRaw === null || companyIdRaw === undefined
      ? null
      : typeof companyIdRaw === "string" && companyIdRaw.length > 0
        ? companyIdRaw
        : null;
  const planLit = companyPlanFromJwtClaim(decoded.companyPlan);
  const companyPlan = isPlanLockedToBasic()
    ? CompanyPlan.BASIC
    : planLit === "ENTERPRISE"
      ? CompanyPlan.ENTERPRISE
      : planLit === "PRO"
        ? CompanyPlan.PRO
        : CompanyPlan.BASIC;
  const workspaceReady = decoded.workspaceReady !== false;
  const rawM = parseJwtMemberships(decoded);
  const memberships = rawM?.map((m) => ({
    companyId: m.companyId,
    plan:
      m.plan === "ENTERPRISE"
        ? CompanyPlan.ENTERPRISE
        : m.plan === "PRO"
          ? CompanyPlan.PRO
          : CompanyPlan.BASIC,
    jobRole: m.jobRole as UserRole,
  }));
  return {
    sub,
    email,
    role: role as UserRole,
    companyId,
    companyPlan,
    workspaceReady,
    ...(memberships?.length ? { memberships } : {}),
  };
}

/**
 * Verify JWT and return the signed-in user (Route Handlers, Server Actions).
 */
export function getAuthUserFromToken(token: string): AuthUser | null {
  const r = verifyAccessTokenResult(token);
  if (!r.ok) return null;
  return payloadToUser(r.payload as Record<string, unknown>);
}

/** Session probe for `/api/auth/me` (distinguishes absent vs expired vs invalid). */
export type MeSession =
  | { status: "none" }
  | { status: "valid"; user: AuthUser }
  | { status: "expired" }
  | { status: "invalid" };

export function getMeSessionFromToken(token: string | undefined): MeSession {
  if (!token?.trim()) return { status: "none" };
  const r = verifyAccessTokenResult(token);
  if (!r.ok) {
    return r.code === "TOKEN_EXPIRED" ? { status: "expired" } : { status: "invalid" };
  }
  const user = payloadToUser(r.payload as Record<string, unknown>);
  if (!user) return { status: "invalid" };
  return { status: "valid", user };
}

/**
 * JWT plus middleware headers: effective tenant is the validated active company (cookie + memberships).
 */
export function getAuthUser(request: NextRequest | Request): AuthUser | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  const tokenUser = getAuthUserFromToken(token);
  if (!tokenUser) return null;

  const hCompany = request.headers.get(AUTH_HEADER_COMPANY_ID);
  const hPlan = request.headers.get(AUTH_HEADER_COMPANY_PLAN);
  const hRole = request.headers.get(AUTH_HEADER_USER_ROLE);
  const hWr = request.headers.get(AUTH_HEADER_WORKSPACE_READY);
  const needsCo = request.headers.get(AUTH_HEADER_NEEDS_COMPANY) === "1";

  if (typeof hCompany === "string" && hCompany.length > 0 && !needsCo) {
    if (membershipCompanyIds(tokenUser).includes(hCompany)) {
      return {
        ...tokenUser,
        companyId: hCompany,
        companyPlan:
          isPlanLockedToBasic()
            ? CompanyPlan.BASIC
            : hPlan === "ENTERPRISE"
              ? CompanyPlan.ENTERPRISE
              : hPlan === "PRO"
                ? CompanyPlan.PRO
                : CompanyPlan.BASIC,
        role: (hRole as UserRole) ?? tokenUser.role,
        workspaceReady: hWr !== "0",
      };
    }
  }

  return tokenUser;
}

/**
 * User attached by middleware (Server Components / layouts under protected routes).
 * Strips spoofed `x-bgos-*` headers first is done in middleware; only read here.
 */
export async function getAuthUserFromHeaders(): Promise<AuthUser | null> {
  const h = await headers();
  const sub = h.get(AUTH_HEADER_USER_ID);
  const email = h.get(AUTH_HEADER_USER_EMAIL);
  const role = h.get(AUTH_HEADER_USER_ROLE);
  const needsCompany = h.get(AUTH_HEADER_NEEDS_COMPANY) === "1";
  const companyId = h.get(AUTH_HEADER_COMPANY_ID);
  const planHeader = h.get(AUTH_HEADER_COMPANY_PLAN);
  if (!sub || !email || !role) return null;
  if (!needsCompany && !companyId) return null;
  const companyPlan = isPlanLockedToBasic()
    ? CompanyPlan.BASIC
    : planHeader === "ENTERPRISE"
      ? CompanyPlan.ENTERPRISE
      : planHeader === "PRO"
        ? CompanyPlan.PRO
        : CompanyPlan.BASIC;
  const workspaceReady = needsCompany ? false : h.get(AUTH_HEADER_WORKSPACE_READY) !== "0";
  return {
    sub,
    email,
    role: role as UserRole,
    companyId: needsCompany ? null : (companyId ?? null),
    companyPlan,
    workspaceReady,
  };
}

/**
 * Session from cookies inside Server Components (verifies JWT, does not rely on middleware).
 */
export async function getAuthUserFromCookies(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return getAuthUserFromToken(token);
}

export function unauthorized(message = "Unauthorized"): NextResponse {
  return NextResponse.json(
    { ok: false as const, error: message, code: "UNAUTHORIZED" },
    { status: 401 },
  );
}

export function forbidden(message = "Forbidden"): NextResponse {
  return NextResponse.json(
    { ok: false as const, error: message, code: "FORBIDDEN" },
    { status: 403 },
  );
}

/**
 * Require a valid session for a Route Handler. Returns user or a 401 response.
 */
export function requireAuth(request: NextRequest | Request): AuthUser | NextResponse {
  const user = getAuthUser(request);
  if (!user) return unauthorized();
  return user;
}

const needsOnboardingResponse = () =>
  NextResponse.json(
    {
      ok: false as const,
      error: "Complete company setup first",
      code: "NEEDS_ONBOARDING" as const,
    },
    { status: 403 },
  );

const workspaceNotActivatedResponse = () =>
  NextResponse.json(
    {
      ok: false as const,
      error: "Complete workspace activation to continue",
      code: "WORKSPACE_NOT_ACTIVATED" as const,
    },
    { status: 403 },
  );

const invalidActiveCompanyResponse = () =>
  NextResponse.json(
    {
      ok: false as const,
      error: "No access to this company",
      code: "INVALID_ACTIVE_COMPANY" as const,
    },
    { status: 403 },
  );

/** Session with a workspace (JWT includes `companyId`). */
export type AuthUserWithCompany = AuthUser & { companyId: string };

/**
 * Resolves the active company from the session and verifies a live `UserCompany` row.
 * Does not require workspace activation (use for onboarding / activate and anywhere JWT
 * may be `workspaceReady: false` but the tenant must still be validated in the DB).
 */
export async function requireActiveCompanyMembership(
  request: NextRequest | Request,
): Promise<AuthUserWithCompany | NextResponse> {
  const result = requireAuth(request);
  if (result instanceof NextResponse) return result;
  if (!result.companyId) return needsOnboardingResponse();

  const live = await prisma.userCompany.findUnique({
    where: {
      userId_companyId: { userId: result.sub, companyId: result.companyId },
    },
    include: { company: { select: { plan: true } } },
  });
  if (!live) return invalidActiveCompanyResponse();

  const companyPlan = isPlanLockedToBasic() ? CompanyPlan.BASIC : live.company.plan;

  return {
    ...result,
    companyId: result.companyId,
    role: live.jobRole,
    companyPlan,
    workspaceReady: result.workspaceReady,
  } as AuthUserWithCompany;
}

/**
 * Require a valid session tied to a company. Use for tenant-scoped APIs (Bearer or cookie).
 * Confirms `UserCompany` in the database for the active company (no cross-tenant leakage)
 * and rejects until workspace activation completes.
 */
export async function requireAuthWithCompany(
  request: NextRequest | Request,
): Promise<AuthUserWithCompany | NextResponse> {
  const tenant = await requireActiveCompanyMembership(request);
  if (tenant instanceof NextResponse) return tenant;
  if (!tenant.workspaceReady) return workspaceNotActivatedResponse();
  return tenant;
}

/**
 * Require session and one of the given roles.
 */
export async function requireAuthWithRoles(
  request: NextRequest | Request,
  allowedRoles: UserRole[],
): Promise<AuthUserWithCompany | NextResponse> {
  const result = await requireAuthWithCompany(request);
  if (result instanceof NextResponse) return result;
  if (!allowedRoles.includes(result.role)) return forbidden();
  return result;
}

export function userHasRole(user: AuthUser, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(user.role);
}
