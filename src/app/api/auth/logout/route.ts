import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session-cookie";

/**
 * Clears the HTTP-only session cookie. Safe to call when already logged out.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true as const });
  clearSessionCookie(res);
  return res;
}
