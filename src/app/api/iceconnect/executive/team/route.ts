import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { currentPeriod } from "@/lib/iceconnect-sales-hub";
import { prisma } from "@/lib/prisma";
import { assertIceconnectInternalSalesOrg } from "@/lib/require-iceconnect-internal-org";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";

const MANAGER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.ADMIN];

const SALES_TEAM_ROLES: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.TECH_HEAD,
  UserRole.TECH_EXECUTIVE,
];

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, MANAGER_ROLES);
  if (session instanceof NextResponse) return session;

  if (!isIceconnectPrivileged(session.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const { year, month } = currentPeriod();

  try {
    const memberships = await prisma.userCompany.findMany({
      where: {
        companyId: session.companyId,
        jobRole: { in: SALES_TEAM_ROLES },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { user: { name: "asc" } },
    });

    const targets = await prisma.salesExecutiveMonthlyTarget.findMany({
      where: {
        companyId: session.companyId,
        periodYear: year,
        periodMonth: month,
        userId: { in: memberships.map((m) => m.userId) },
      },
    });
    const byUser = new Map(targets.map((t) => [t.userId, t]));

    return NextResponse.json({
      ok: true as const,
      period: { year, month },
      members: memberships.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.jobRole,
        target: byUser.get(m.userId) ?? null,
      })),
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/iceconnect/executive/team", e);
  }
}
