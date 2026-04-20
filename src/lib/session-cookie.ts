import "server-only";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import type { NextResponse } from "next/server";
import { ACTIVE_COMPANY_COOKIE_NAME, AUTH_COOKIE_NAME } from "./auth-config";

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

async function productionCookieDomain(): Promise<string | undefined> {
  if (process.env.NODE_ENV !== "production") return undefined;

  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host");
  const hostHeader = forwardedHost ?? h.get("host") ?? "";
  const host = hostHeader.split(":")[0]?.toLowerCase() ?? "";

  if (host === "bgos.online" || host.endsWith(".bgos.online")) {
    return process.env.AUTH_COOKIE_DOMAIN_BGOS?.trim() || ".bgos.online";
  }
  if (host === "iceconnect.in" || host.endsWith(".iceconnect.in")) {
    return process.env.AUTH_COOKIE_DOMAIN_ICE?.trim() || ".iceconnect.in";
  }
  return undefined;
}

async function sessionCookieOptions(maxAge: number) {
  const isProd = process.env.NODE_ENV === "production";
  const domain = await productionCookieDomain();
  return {
    httpOnly: true as const,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    ...(domain ? { domain } : {}),
  };
}

/**
 * Attach HTTP-only session cookie (JWT) via `cookies()` so Set-Cookie is applied
 * to the Route Handler response (avoids cases where `res.cookies` alone is dropped).
 */
export async function setSessionCookie(_res: NextResponse, token: string): Promise<void> {
  const jar = await cookies();
  jar.set(AUTH_COOKIE_NAME, token, await sessionCookieOptions(SESSION_MAX_AGE_SEC));
}

export async function clearSessionCookie(_res: NextResponse): Promise<void> {
  const jar = await cookies();
  jar.set(AUTH_COOKIE_NAME, "", await sessionCookieOptions(0));
}

export async function setActiveCompanyCookie(_res: NextResponse, companyId: string): Promise<void> {
  const jar = await cookies();
  jar.set(
    ACTIVE_COMPANY_COOKIE_NAME,
    companyId,
    await sessionCookieOptions(SESSION_MAX_AGE_SEC),
  );
}

export async function clearActiveCompanyCookie(_res: NextResponse): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_COMPANY_COOKIE_NAME, "", await sessionCookieOptions(0));
}
