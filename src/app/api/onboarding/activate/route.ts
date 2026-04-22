import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireActiveCompanyMembership } from "@/lib/auth";
import { loadMembershipsForJwt } from "@/lib/memberships-for-jwt";
import { jsonError, logCaughtError } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { setActiveCompanyCookie, setSessionCookie } from "@/lib/session-cookie";
import { signAccessToken } from "@/lib/jwt";
import { isSuperBossEmail } from "@/lib/super-boss";
import { getNextBdmId } from "@/lib/bdm-round-robin";

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
    } catch (e) {
      logCaughtError("POST /api/onboarding/activate sign JWT (alreadyActivated)", e);
      return jsonError(500, "SERVER_ERROR", "Authentication is not configured", e instanceof Error ? e.message : String(e));
    }
    const res = NextResponse.json({ ok: true as const, alreadyActivated: true as const });
    await setSessionCookie(res, token);
    await setActiveCompanyCookie(res, companyId);
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

    // Non-fatal website-signup lead auto-creation for BDM queue.
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, industry: true },
      });
      const user = await prisma.user.findUnique({
        where: { id: session.sub },
        select: { id: true, name: true, email: true, mobile: true },
      });

      if (company && user) {
        const existingWebsiteLead = await prisma.lead.findFirst({
          where: { companyId: company.id, source: "WEBSITE" },
          select: { id: true },
        });

        if (!existingWebsiteLead) {
          const assignedBdmId = await getNextBdmId(company.id);
          await prisma.lead.create({
            data: {
              name: user.name || "Website Signup",
              email: user.email,
              phone: user.mobile || "",
              source: "WEBSITE",
              status: "NEW",
              leadCompanyName: company.name,
              businessType: String(company.industry),
              companyId: company.id,
              assignedTo: assignedBdmId,
              createdByUserId: user.id,
              internalSalesNotes: "Self signup via bgos.online",
              lastActivityAt: new Date(),
            },
          });

          if (assignedBdmId) {
            await prisma.internalInAppNotification.create({
              data: {
                companyId: company.id,
                userId: assignedBdmId,
                title: "New Lead Assigned",
                body: `New website signup: ${company.name}`,
                type: "LEAD_ASSIGNED",
              },
            });
          }
        }
      }
    } catch (leadCreateError) {
      console.error("[bgos] lead auto-create failed", leadCreateError);
    }
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
  } catch (e) {
    logCaughtError("POST /api/onboarding/activate sign JWT", e);
    return jsonError(500, "SERVER_ERROR", "Authentication is not configured", e instanceof Error ? e.message : String(e));
  }

  const res = NextResponse.json({ ok: true as const });
  await setSessionCookie(res, token);
  await setActiveCompanyCookie(res, companyId);
  return res;
}
