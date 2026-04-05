import "server-only";

import type { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "./auth-config";

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function baseCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
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
