import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { ACTIVE_COMPANY_COOKIE_NAME, AUTH_COOKIE_NAME } from "@/lib/auth-config";
import { getMeSessionFromToken } from "@/lib/auth";
import { isPlanLockedToBasic } from "@/lib/plan-production-lock";
import { prisma } from "@/lib/prisma";

/**
 * Current session (cookie JWT). No cookie → `authenticated: false` (200).
 * Bad or expired token → 401 with `TOKEN_EXPIRED` / `TOKEN_INVALID`.
 */
export async function GET() {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE_NAME)?.value;
  const activeCompanyIdCookie = jar.get(ACTIVE_COMPANY_COOKIE_NAME)?.value ?? null;
  const session = getMeSessionFromToken(token);

  switch (session.status) {
    case "none":
      return jsonSuccess({
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
    case "valid": {
      const u = await prisma.user.findUnique({
        where: { id: session.user.sub },
        select: { name: true },
      });
      return jsonSuccess({
        authenticated: true as const,
        planLockedToBasic: isPlanLockedToBasic(),
        user: {
          id: session.user.sub,
          name: u?.name ?? "",
          email: session.user.email,
          role: session.user.role,
          companyId: session.user.companyId,
          companyPlan: session.user.companyPlan,
          needsOnboarding: session.user.companyId === null,
          workspaceReady: session.user.workspaceReady,
          needsWorkspaceActivation:
            session.user.companyId !== null && !session.user.workspaceReady,
          activeCompanyIdCookie,
          memberships: session.user.memberships ?? null,
        },
      });
    }
  }
}
