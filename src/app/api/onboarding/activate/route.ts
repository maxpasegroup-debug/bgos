import { CompanyPlan, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireActiveCompanyMembership } from "@/lib/auth";
import { loadMembershipsForJwt } from "@/lib/memberships-for-jwt";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { setActiveCompanyCookie, setSessionCookie } from "@/lib/session-cookie";
import { signAccessToken } from "@/lib/jwt";
import { isSuperBossEmail } from "@/lib/super-boss";

/**
 * Completes onboarding step 2 (NEXA activation). Sets `workspaceActivatedAt` and re-issues JWT with `workspaceReady: true`.
 */
export async function POST(request: NextRequest) {
  const session = await requireActiveCompanyMembership(request);
  if (session instanceof NextResponse) return session;

  if (!session.companyId) {
    return NextResponse.json(
      { ok: false as const, error: "Create your company first", code: "NEEDS_ONBOARDING" },
      { status: 403 },
    );
  }

  const companyId = session.companyId;

  if (session.workspaceReady) {
    const mems = await loadMembershipsForJwt(session.sub);
    const primary = mems[0]!;
    let token: string;
    try {
      token = signAccessToken({
        sub: session.sub,
        email: session.email,
        role: primary.jobRole,
        companyId: primary.companyId,
        companyPlan: primary.plan,
        workspaceReady: true,
        memberships: mems,
        ...(isSuperBossEmail(session.email) ? { superBoss: true as const } : {}),
      });
    } catch {
      return NextResponse.json(
        { ok: false as const, error: "Authentication is not configured", code: "SERVER_ERROR" },
        { status: 500 },
      );
    }
    const res = NextResponse.json({ ok: true as const, alreadyActivated: true as const });
    setSessionCookie(res, token);
    setActiveCompanyCookie(res, companyId);
    return res;
  }

  if (session.role !== UserRole.ADMIN && session.role !== UserRole.MANAGER) {
    return NextResponse.json(
      { ok: false as const, error: "Only workspace admins can activate", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  try {
    await prisma.user.update({
      where: { id: session.sub },
      data: { workspaceActivatedAt: new Date() },
    });
  } catch (e) {
    return handleApiError("POST /api/onboarding/activate", e);
  }

  const mems = await loadMembershipsForJwt(session.sub);
  const primary = mems[0]!;

  let token: string;
  try {
    token = signAccessToken({
      sub: session.sub,
      email: session.email,
      role: primary.jobRole,
      companyId: primary.companyId,
      companyPlan: primary.plan,
      workspaceReady: true,
      memberships: mems,
      ...(isSuperBossEmail(session.email) ? { superBoss: true as const } : {}),
    });
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Authentication is not configured", code: "SERVER_ERROR" },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ ok: true as const });
  setSessionCookie(res, token);
  setActiveCompanyCookie(res, companyId);
  return res;
}
