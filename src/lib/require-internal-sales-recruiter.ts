import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SalesNetworkRole } from "@prisma/client";
import { type AuthUser, getAuthUser, getAuthUserFromToken, getTokenFromRequest } from "@/lib/auth";
import { verifyAccessTokenResult } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { isSuperBossEmail } from "@/lib/super-boss";

export type InternalRecruiterSession = AuthUser & { internalCompanyId: string };

/**
 * Platform super boss or internal-org {@link SalesNetworkRole.BOSS} may recruit RSM/BDE/Tech.
 */
export async function requireInternalSalesRecruiter(
  request: NextRequest | Request,
  internalCompanyId: string,
): Promise<InternalRecruiterSession | NextResponse> {
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
  if (isSuperBossEmail(user.email)) {
    return { ...user, internalCompanyId };
  }
  const mem = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: user.sub, companyId: internalCompanyId } },
    select: { salesNetworkRole: true },
  });
  if (mem?.salesNetworkRole === SalesNetworkRole.BOSS) {
    return { ...user, internalCompanyId };
  }
  return NextResponse.json(
    {
      ok: false as const,
      error: "Only the workspace Boss or platform owner can add sales network members.",
      code: "FORBIDDEN" as const,
    },
    { status: 403 },
  );
}
