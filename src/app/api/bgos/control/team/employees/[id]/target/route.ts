import { IceconnectCustomerPlan } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { currentPeriod } from "@/lib/iceconnect-sales-hub";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  monthlyTargetCount: z.number().int().min(0),
  salaryRupees: z.number().int().min(0),
  targetPlan: z.nativeEnum(IceconnectCustomerPlan).optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = requireInternalPlatformApi(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const employeeId = id.trim();
  if (!employeeId) {
    return NextResponse.json({ ok: false as const, error: "Missing employee id" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  if (!json) return NextResponse.json({ ok: false as const, error: "Invalid JSON body" }, { status: 400 });
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false as const, error: parsed.error.flatten(), code: "VALIDATION_ERROR" }, { status: 400 });
  }

  const org = await getOrCreateInternalSalesCompanyId();
  if ("error" in org) {
    return NextResponse.json(
      { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
      { status: 500 },
    );
  }
  const companyId = org.companyId;

  const member = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: employeeId, companyId } },
    select: { userId: true },
  });
  if (!member) return NextResponse.json({ ok: false as const, error: "Employee not found" }, { status: 404 });

  const period = currentPeriod();
  const row = await prisma.salesExecutiveMonthlyTarget.upsert({
    where: {
      companyId_userId_periodYear_periodMonth: {
        companyId,
        userId: employeeId,
        periodYear: period.year,
        periodMonth: period.month,
      },
    },
    create: {
      companyId,
      userId: employeeId,
      periodYear: period.year,
      periodMonth: period.month,
      targetCount: parsed.data.monthlyTargetCount,
      targetPlan: parsed.data.targetPlan ?? IceconnectCustomerPlan.BASIC,
      salaryRupees: parsed.data.salaryRupees,
    },
    update: {
      targetCount: parsed.data.monthlyTargetCount,
      salaryRupees: parsed.data.salaryRupees,
      ...(parsed.data.targetPlan ? { targetPlan: parsed.data.targetPlan } : {}),
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
}

