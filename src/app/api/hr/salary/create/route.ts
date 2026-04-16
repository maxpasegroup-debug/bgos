import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithCompany } from "@/lib/auth";
import { isHrManagerRole } from "@/lib/hr";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  userId: z.string().cuid(),
  amount: z.number().finite().positive(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM"),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (!isHrManagerRole(session.role)) {
    return NextResponse.json({ ok: false as const, error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false as const, error: "Invalid JSON", code: "BAD_REQUEST" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });
  }

  const member = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: parsed.data.userId, companyId: session.companyId } },
    select: { userId: true },
  });
  if (!member) {
    return NextResponse.json({ ok: false as const, error: "User not found in company", code: "NOT_FOUND" }, { status: 404 });
  }

  // HR payout lock: only allow creating salary payout records if employee KYC is verified.
  // We use raw SQL for KYC columns in case Prisma client regeneration is pending.
  const kycRows = await prisma.$queryRawUnsafe<Array<{ kycStatus: string | null }>>(
    `SELECT "kycStatus" FROM "UserCompany" WHERE "companyId" = ? AND "userId" = ?`,
    session.companyId,
    parsed.data.userId,
  );
  const kycStatus = kycRows?.[0]?.kycStatus ?? "PENDING";
  if (kycStatus !== "VERIFIED") {
    return NextResponse.json(
      { ok: false as const, error: "Complete KYC to receive payouts", code: "KYC_REQUIRED" },
      { status: 403 },
    );
  }

  const row = await (prisma as any).salary.upsert({
    where: {
      companyId_userId_month: {
        companyId: session.companyId,
        userId: parsed.data.userId,
        month: parsed.data.month,
      },
    },
    update: { amount: parsed.data.amount },
    create: {
      companyId: session.companyId,
      userId: parsed.data.userId,
      amount: parsed.data.amount,
      month: parsed.data.month,
    },
  });

  return NextResponse.json({
    ok: true as const,
    salary: { id: row.id, userId: row.userId, amount: row.amount, month: row.month },
  });
}
