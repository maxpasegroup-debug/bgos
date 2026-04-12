import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { type AuthUser, getTokenFromRequest, requireAuth } from "@/lib/auth";
import { verifyAccessTokenResult } from "@/lib/jwt";
import { isSuperBossEmail } from "@/lib/super-boss";

/**
 * Route handler guard: configured boss email + JWT `superBoss` claim.
 */
export function requireSuperBossApi(
  request: NextRequest | Request,
): AuthUser | NextResponse {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json(
      { ok: false as const, error: "Unauthorized", code: "UNAUTHORIZED" as const },
      { status: 401 },
    );
  }
  const vr = verifyAccessTokenResult(token);
  const payload = vr.ok ? (vr.payload as Record<string, unknown>) : null;
  if (payload?.superBoss !== true || !isSuperBossEmail(user.email)) {
    return NextResponse.json(
      { ok: false as const, error: "Forbidden", code: "FORBIDDEN" as const },
      { status: 403 },
    );
  }
  return user;
}
