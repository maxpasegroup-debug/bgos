import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const session = requireInternalPlatformApi(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const employeeId = id.trim();
  if (!employeeId) {
    return NextResponse.json({ ok: false as const, error: "Missing employee id" }, { status: 400 });
  }

  const org = await getOrCreateInternalSalesCompanyId();
  if ("error" in org) {
    return NextResponse.json(
      { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
      { status: 500 },
    );
  }
  const companyId = org.companyId;

  const exists = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: employeeId, companyId } },
    select: { userId: true },
  });
  if (!exists) {
    return NextResponse.json({ ok: false as const, error: "Employee not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: employeeId },
      data: { isActive: true },
    });
    await tx.$executeRawUnsafe(
      `UPDATE "UserCompany" SET "status" = 'ACTIVE' WHERE "companyId" = ? AND "userId" = ?`,
      companyId,
      employeeId,
    );
  });

  return NextResponse.json({
    ok: true as const,
    status: "ACTIVE" as const,
    message: "Employee restored. ICECONNECT access enabled.",
  });
}

