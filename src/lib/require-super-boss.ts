import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { type AuthUser, getAuthUser, getAuthUserFromToken, getTokenFromRequest } from "@/lib/auth";
import { verifyAccessTokenResult } from "@/lib/jwt";
import { getBgosBossEmail, isSuperBossEmail } from "@/lib/super-boss";

/**
 * Route handler guard: session must match `BGOS_BOSS_EMAIL` (verified JWT email).
 * JWT `superBoss` is preferred but not required — older sessions may lack the claim until refresh.
 */
export function requireSuperBossApi(
  request: NextRequest | Request,
): AuthUser | NextResponse {
  const token = getTokenFromRequest(request);
  let user = getAuthUser(request);
  if (!user && token) {
    user = getAuthUserFromToken(token);
  }
  if (!user || !token) {
    return NextResponse.json(
      { ok: false as const, error: "Unauthorized", code: "UNAUTHORIZED" as const },
      { status: 401 },
    );
  }
  const vr = verifyAccessTokenResult(token);
  if (!vr.ok) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid or expired session", code: "TOKEN_INVALID" as const },
      { status: 401 },
    );
  }
  const payload = vr.payload as Record<string, unknown>;
  const bossEmailConfigured = getBgosBossEmail().length > 0;
  if (!bossEmailConfigured) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Platform boss email is not configured (set BGOS_BOSS_EMAIL).",
        code: "MISCONFIGURED" as const,
      },
      { status: 503 },
    );
  }
  if (!isSuperBossEmail(user.email)) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "This action is only available for the platform boss account.",
        code: "FORBIDDEN" as const,
      },
      { status: 403 },
    );
  }
  if (payload.superBoss !== true) {
    console.warn(
      "[requireSuperBossApi] JWT missing superBoss claim; allowing verified BGOS_BOSS_EMAIL — re-login or POST /api/auth/refresh-session to refresh token.",
    );
  }
  return user;
}
