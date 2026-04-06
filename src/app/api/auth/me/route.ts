import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-config";
import { getMeSessionFromToken } from "@/lib/auth";
import { isPlanLockedToBasic } from "@/lib/plan-production-lock";

/**
 * Current session (cookie JWT). No cookie → `authenticated: false` (200).
 * Bad or expired token → 401 with `TOKEN_EXPIRED` / `TOKEN_INVALID`.
 */
export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  const session = getMeSessionFromToken(token);

  switch (session.status) {
    case "none":
      return NextResponse.json({
        ok: true as const,
        authenticated: false as const,
      });
    case "expired":
      return NextResponse.json(
        {
          ok: false as const,
          authenticated: false as const,
          code: "TOKEN_EXPIRED" as const,
          error: "Session expired — please sign in again",
        },
        { status: 401 },
      );
    case "invalid":
      return NextResponse.json(
        {
          ok: false as const,
          authenticated: false as const,
          code: "TOKEN_INVALID" as const,
          error: "Invalid or expired session",
        },
        { status: 401 },
      );
    case "valid":
      return NextResponse.json({
        ok: true as const,
        authenticated: true as const,
        planLockedToBasic: isPlanLockedToBasic(),
        user: {
          id: session.user.sub,
          email: session.user.email,
          role: session.user.role,
          companyId: session.user.companyId,
          companyPlan: session.user.companyPlan,
        },
      });
  }
}
