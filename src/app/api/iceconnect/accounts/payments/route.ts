import { PaymentStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseIceconnectListQuery } from "@/lib/api-query";
import { prismaKnownErrorResponse, zodValidationErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.ACCOUNTS]);
  if (session instanceof NextResponse) return session;

  const parsed = parseIceconnectListQuery(request, 200);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }
  const take = parsed.data.limit;

  let payments;
  let summary: { totalPaid: number; totalPending: number; recordCount: number };
  try {
    const [rows, paidAgg, pendingAgg, count] = await Promise.all([
      prisma.payment.findMany({
        where: { companyId: session.companyId },
        orderBy: { createdAt: "desc" },
        take,
      }),
      prisma.payment.aggregate({
        where: { companyId: session.companyId, status: PaymentStatus.PAID },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { companyId: session.companyId, status: PaymentStatus.PENDING },
        _sum: { amount: true },
      }),
      prisma.payment.count({ where: { companyId: session.companyId } }),
    ]);
    payments = rows;
    summary = {
      totalPaid: paidAgg._sum.amount ?? 0,
      totalPending: pendingAgg._sum.amount ?? 0,
      recordCount: count,
    };
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/iceconnect/accounts/payments", e);
  }

  return NextResponse.json({
    ok: true as const,
    summary,
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
