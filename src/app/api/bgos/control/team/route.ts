import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { logCaughtError } from "@/lib/api-response";
import { getApiCache, setApiCache } from "@/lib/api-runtime-cache";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";

const SALES_DEPT_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.SALES_EXECUTIVE];
const TECH_DEPT_ROLES: UserRole[] = [UserRole.TECH_HEAD, UserRole.TECH_EXECUTIVE];

export async function GET(request: NextRequest) {
  try {
    const session = requireSuperBossApi(request);
    if (session instanceof NextResponse) return session;

    const org = await getOrCreateInternalSalesCompanyId();
    if ("error" in org) {
      return NextResponse.json(
        { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
        { status: 500 },
      );
    }
    const cacheKey = `control:team:${org.companyId}`;
    const cached = getApiCache<{
      internalCompanyId: string;
      departments: {
        sales: { userId: string; name: string; email: string; role: UserRole }[];
        tech: { userId: string; name: string; email: string; role: UserRole }[];
      };
    }>(cacheKey);
    if (cached) {
      return NextResponse.json({
        ok: true as const,
        internalCompanyId: cached.internalCompanyId,
        departments: cached.departments,
      });
    }

    const memberships = await prisma.userCompany.findMany({
    where: { companyId: org.companyId },
    select: {
      jobRole: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const sales = memberships
    .filter((m) => SALES_DEPT_ROLES.includes(m.jobRole))
    .map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.jobRole,
    }));

  const tech = memberships
    .filter((m) => TECH_DEPT_ROLES.includes(m.jobRole))
    .map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.jobRole,
    }));

    const payload = {
      ok: true as const,
      internalCompanyId: org.companyId,
      departments: {
        sales,
        tech,
      },
    };
    setApiCache(cacheKey, {
      internalCompanyId: payload.internalCompanyId,
      departments: payload.departments,
    });
    return NextResponse.json(payload);
  } catch (e) {
    logCaughtError("GET /api/bgos/control/team", e);
    return NextResponse.json(
      {
        ok: false as const,
        error: "Could not load team",
        code: "SERVER_ERROR" as const,
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
