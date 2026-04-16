import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  status: z.enum(["PENDING", "VERIFIED"]),
  bankDetails: z.string().trim().max(500).optional(),
  pan: z.string().trim().max(32).optional(),
  panDocumentId: z.string().trim().min(1).optional().nullable(),
  idDocumentId: z.string().trim().min(1).optional().nullable(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = requireSuperBossApi(request);
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

  const exists = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: employeeId, companyId } },
    select: { userId: true },
  });
  if (!exists) return NextResponse.json({ ok: false as const, error: "Employee not found" }, { status: 404 });

  await prisma.$executeRawUnsafe(
    `UPDATE "UserCompany"
     SET "kycStatus" = ?, "kycBankDetails" = ?, "kycPan" = ?, "kycPanDocumentId" = ?, "kycIdDocumentId" = ?, "kycUpdatedAt" = NOW()
     WHERE "companyId" = ? AND "userId" = ?`,
    parsed.data.status,
    parsed.data.bankDetails ?? null,
    parsed.data.pan ?? null,
    parsed.data.panDocumentId ?? null,
    parsed.data.idDocumentId ?? null,
    companyId,
    employeeId,
  );

  return NextResponse.json({
    ok: true as const,
    status: parsed.data.status,
  });
}

