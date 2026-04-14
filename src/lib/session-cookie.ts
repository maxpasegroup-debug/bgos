import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { ACTIVE_COMPANY_COOKIE_NAME, AUTH_COOKIE_NAME } from "./auth-config";

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/** Same-origin session cookies only — never set `domain`. */
function sessionCookieOptions(maxAge: number) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * Attach HTTP-only session cookie (JWT) via `cookies()` so Set-Cookie is applied
 * to the Route Handler response (avoids cases where `res.cookies` alone is dropped).
 */
export async function setSessionCookie(_res: NextResponse, token: string): Promise<void> {
  const jar = await cookies();
  jar.set(AUTH_COOKIE_NAME, token, sessionCookieOptions(SESSION_MAX_AGE_SEC));
}

export async function clearSessionCookie(_res: NextResponse): Promise<void> {
  const jar = await cookies();
  jar.set(AUTH_COOKIE_NAME, "", sessionCookieOptions(0));
}

export async function setActiveCompanyCookie(_res: NextResponse, companyId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_COMPANY_COOKIE_NAME, companyId, sessionCookieOptions(SESSION_MAX_AGE_SEC));
}

export async function clearActiveCompanyCookie(_res: NextResponse): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_COMPANY_COOKIE_NAME, "", sessionCookieOptions(0));
}
