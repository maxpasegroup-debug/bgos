import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireActiveCompanyMembership } from "@/lib/auth";
import { MintSessionTokenError, mintSessionAccessToken } from "@/lib/mint-session-token";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/route-error";
import { setActiveCompanyCookie, setSessionCookie } from "@/lib/session-cookie";

export const switchCompanyBodySchema = z.object({
  companyId: z.string().trim().min(1),
});

/**
 * Validate membership and set the active-company HTTP-only cookie.
 */
export async function switchActiveCompanyPost(
  request: NextRequest,
): Promise<NextResponse> {
  const session = await requireActiveCompanyMembership(request);
  if (session instanceof NextResponse) return session;
  if (!session.workspaceReady) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Complete workspace activation first",
        code: "WORKSPACE_NOT_ACTIVATED" as const,
      },
      { status: 403 },
    );
  }

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;

  const parsed = switchCompanyBodySchema.safeParse(raw.data);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }

  const { companyId } = parsed.data;

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

  let token: string;
  try {
    token = await mintSessionAccessToken({
      userId: session.sub,
      email: session.email,
      activeCompanyId: companyId,
    });
  } catch (e) {
    if (e instanceof MintSessionTokenError) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "Could not update session for this company",
          code: e.code,
        },
        { status: 500 },
      );
    }
    return handleApiError("POST /api/company/switch", e);
  }

  const res = NextResponse.json({ ok: true as const, companyId });
  setSessionCookie(res, token);
  setActiveCompanyCookie(res, companyId);
  return res;
}
