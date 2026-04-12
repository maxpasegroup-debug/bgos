import { IceconnectCustomerPlan, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";
import { assertIceconnectInternalSalesOrg } from "@/lib/require-iceconnect-internal-org";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";

const MANAGER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.ADMIN];

const upsertSchema = z.object({
  userId: z.string().trim().min(1),
  periodYear: z.number().int().min(2020).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  targetCount: z.number().int().min(0).max(10000),
  targetPlan: z.nativeEnum(IceconnectCustomerPlan),
  salaryRupees: z.number().int().min(0).max(100_000_000),
});

export async function PUT(request: NextRequest) {
  const session = await requireIceconnectRole(request, MANAGER_ROLES);
  if (session instanceof NextResponse) return session;

  if (!isIceconnectPrivileged(session.role)) {
    return jsonError(403, "FORBIDDEN", "Only managers can set targets.");
  }

  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const parsed = await parseJsonBodyZod(request, upsertSchema);
  if (!parsed.ok) return parsed.response;

  const { userId, periodYear, periodMonth, targetCount, targetPlan, salaryRupees } = parsed.data;

  try {
    const member = await prisma.userCompany.findUnique({
      where: {
        userId_companyId: { userId, companyId: session.companyId },
      },
    });
    if (!member) {
      return jsonError(404, "NOT_MEMBER", "User is not in this company.");
    }

    const row = await prisma.salesExecutiveMonthlyTarget.upsert({
      where: {
        companyId_userId_periodYear_periodMonth: {
          companyId: session.companyId,
          userId,
          periodYear,
          periodMonth,
        },
      },
      create: {
        companyId: session.companyId,
        userId,
        periodYear,
        periodMonth,
        targetCount,
        targetPlan,
        salaryRupees,
      },
      update: {
        targetCount,
        targetPlan,
        salaryRupees,
      },
    });

    return NextResponse.json({
      ok: true as const,
      target: {
        userId: row.userId,
        periodYear: row.periodYear,
        periodMonth: row.periodMonth,
        targetCount: row.targetCount,
        targetPlan: row.targetPlan,
        salaryRupees: row.salaryRupees,
      },
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("PUT /api/iceconnect/executive/target", e);
  }
}
