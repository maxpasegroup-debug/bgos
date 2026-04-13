import "server-only";

import type { NextResponse } from "next/server";
import { ACTIVE_COMPANY_COOKIE_NAME, AUTH_COOKIE_NAME } from "./auth-config";

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function sessionCookieDomain(): string | undefined {
  const d = process.env.COOKIE_DOMAIN?.trim();
  if (!d) return undefined;
  return d;
}

function baseCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  const domain = sessionCookieDomain();
  return {
    httpOnly: true as const,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    ...(domain ? { domain } : {}),
  };
}

/** Attach HTTP-only session cookie (JWT). */
export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

/** Clear session cookie (logout). */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(AUTH_COOKIE_NAME, "", {
    ...baseCookieOptions(),
    maxAge: 0,
  });
}

export function setActiveCompanyCookie(res: NextResponse, companyId: string): void {
  res.cookies.set(ACTIVE_COMPANY_COOKIE_NAME, companyId, {
    ...baseCookieOptions(),
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export function clearActiveCompanyCookie(res: NextResponse): void {
  res.cookies.set(ACTIVE_COMPANY_COOKIE_NAME, "", {
    ...baseCookieOptions(),
    maxAge: 0,
  });
}
