import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { getTokenFromRequest, requireAuth } from "@/lib/auth";
import { requireActiveCompanyMembership } from "@/lib/auth";
import { MintSessionTokenError, mintSessionAccessTokenForUser } from "@/lib/mint-session-token";
import { verifyAccessTokenResult } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/route-error";
import { isSuperBossEmail } from "@/lib/super-boss";
import { setActiveCompanyCookie, setSessionCookie } from "@/lib/session-cookie";

export const switchCompanyBodySchema = z.object({
  companyId: z.string().trim().min(1),
});

const workspaceNotActivated = () =>
  NextResponse.json(
    {
      ok: false as const,
      error: "Complete workspace activation first",
      code: "WORKSPACE_NOT_ACTIVATED" as const,
    },
    { status: 403 },
  );

/**
 * Validate membership (or super-boss override) and set the active-company HTTP-only cookie.
 */
export async function switchActiveCompanyPost(
  request: NextRequest,
): Promise<NextResponse> {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;

  const parsed = switchCompanyBodySchema.safeParse(raw.data);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }

  const { companyId } = parsed.data;

  const tokenStr = getTokenFromRequest(request);
  const vr = tokenStr ? verifyAccessTokenResult(tokenStr) : { ok: false as const };
  const payload = vr.ok ? (vr.payload as Record<string, unknown>) : null;
  const jwtSuperBoss = payload?.superBoss === true;
  const superBossOk = jwtSuperBoss === true && isSuperBossEmail(auth.email);

  if (!superBossOk) {
    const session = await requireActiveCompanyMembership(request);
    if (session instanceof NextResponse) return session;
    if (!session.workspaceReady) return workspaceNotActivated();

    const membership = await prisma.userCompany.findUnique({
      where: {
        userId_companyId: { userId: session.sub, companyId },
      },
    });
    if (!membership) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "You are not a member of this company",
          code: "NOT_A_MEMBER" as const,
        },
        { status: 403 },
      );
    }
  } else {
    const u = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { workspaceActivatedAt: true },
    });
    if (!u?.workspaceActivatedAt) return workspaceNotActivated();
  }

  let token: string;
  try {
    token = await mintSessionAccessTokenForUser({
      userId: auth.sub,
      email: auth.email,
      activeCompanyId: companyId,
    });
  } catch (e) {
    if (e instanceof MintSessionTokenError) {
      const status = e.code === "NO_COMPANY" ? 404 : 500;
      return NextResponse.json(
        {
          ok: false as const,
          error:
            e.code === "NO_COMPANY" ? "Company not found" : "Could not update session for this company",
          code: e.code,
        },
        { status },
      );
    }
    return handleApiError("POST /api/company/switch", e);
  }

  const co = await prisma.company.findUnique({
    where: { id: companyId },
    select: { internalSalesOrg: true },
  });
  const redirectPath =
    co?.internalSalesOrg === true ? "/iceconnect/my-journey" : "/bgos/dashboard";

  const res = NextResponse.json({
    ok: true as const,
    companyId,
    redirectPath,
  });
  await setSessionCookie(res, token);
  await setActiveCompanyCookie(res, companyId);
  return res;
}
