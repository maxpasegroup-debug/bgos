import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { type AuthUser, getAuthUser, getAuthUserFromToken, getTokenFromRequest } from "@/lib/auth";
import { verifyAccessTokenResult } from "@/lib/jwt";
import { isSuperBossEmail } from "@/lib/super-boss";

/**
 * BGOS platform internal APIs (`/api/internal/*` and legacy `/api/bgos/control/*` for internal tools):
 * super boss OR {@link User.isInternal} (JWT `isInternal`).
 */
export function requireInternalPlatformApi(
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
  if (isSuperBossEmail(user.email)) {
    return user;
  }
  if (payload.isInternal === true) {
    return user;
  }
  return NextResponse.json(
    {
      ok: false as const,
      error: "Internal platform only",
      code: "FORBIDDEN" as const,
    },
    { status: 403 },
  );
}
