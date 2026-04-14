import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireActiveCompanyMembership } from "@/lib/auth";
import { MintSessionTokenError, mintSessionAccessTokenForUser } from "@/lib/mint-session-token";
import { handleApiError } from "@/lib/route-error";
import { setSessionCookie } from "@/lib/session-cookie";

/**
 * Re-issue the JWT from DB (`Company.plan` per membership). Use after a subscription
 * change so middleware `x-bgos-company-plan` matches the active company.
 */
export async function POST(request: NextRequest) {
  const session = await requireActiveCompanyMembership(request);
  if (session instanceof NextResponse) return session;

  try {
    const token = await mintSessionAccessTokenForUser({
      userId: session.sub,
      email: session.email,
      activeCompanyId: session.companyId,
    });
    const res = jsonSuccess({ refreshed: true });
    await setSessionCookie(res, token);
    return res;
  } catch (e) {
    if (e instanceof MintSessionTokenError) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "Could not refresh session",
          code: e.code,
        },
        { status: 500 },
      );
    }
    return handleApiError("POST /api/auth/refresh-session", e);
  }
}
