import "server-only";

import { CompanyPlan, type UserRole } from "@prisma/client";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { AccessTokenPayload } from "@/types";
import {
  AUTH_COOKIE_NAME,
  AUTH_HEADER_COMPANY_ID,
  AUTH_HEADER_COMPANY_PLAN,
  AUTH_HEADER_USER_EMAIL,
  AUTH_HEADER_USER_ID,
  AUTH_HEADER_USER_ROLE,
  companyPlanFromJwtClaim,
} from "./auth-config";
import { verifyAccessTokenResult } from "./jwt";
import { isPlanLockedToBasic } from "./plan-production-lock";

export type AuthUser = AccessTokenPayload;

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
  const companyId = decoded.companyId;
  if (typeof sub !== "string" || !sub) return null;
  if (typeof email !== "string" || !email) return null;
  if (typeof role !== "string" || !role) return null;
  if (typeof companyId !== "string" || !companyId) return null;
  const planLit = companyPlanFromJwtClaim(decoded.companyPlan);
  const companyPlan = isPlanLockedToBasic()
    ? CompanyPlan.BASIC
    : planLit === "PRO"
      ? CompanyPlan.PRO
      : CompanyPlan.BASIC;
  return { sub, email, role: role as UserRole, companyId, companyPlan };
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

export function getAuthUser(request: NextRequest | Request): AuthUser | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return getAuthUserFromToken(token);
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
  const companyId = h.get(AUTH_HEADER_COMPANY_ID);
  const planHeader = h.get(AUTH_HEADER_COMPANY_PLAN);
  if (!sub || !email || !role || !companyId) return null;
  const companyPlan = isPlanLockedToBasic()
    ? CompanyPlan.BASIC
    : planHeader === "PRO"
      ? CompanyPlan.PRO
      : CompanyPlan.BASIC;
  return { sub, email, role: role as UserRole, companyId, companyPlan };
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

/**
 * Require session and one of the given roles.
 */
export function requireAuthWithRoles(
  request: NextRequest | Request,
  allowedRoles: UserRole[],
): AuthUser | NextResponse {
  const result = requireAuth(request);
  if (result instanceof NextResponse) return result;
  if (!allowedRoles.includes(result.role)) return forbidden();
  return result;
}

export function userHasRole(user: AuthUser, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(user.role);
}
