import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseIceconnectListQuery } from "@/lib/api-query";
import {
  internalServerErrorResponse,
  prismaKnownErrorResponse,
  zodValidationErrorResponse,
} from "@/lib/api-response";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = requireIceconnectRole(request, [UserRole.ACCOUNTS]);
  if (session instanceof NextResponse) return session;

  const parsed = parseIceconnectListQuery(request, 200);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }
  const take = parsed.data.limit;

  let payments;
  try {
    payments = await prisma.payment.findMany({
      where: { companyId: session.companyId },
      orderBy: { createdAt: "desc" },
      take,
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return internalServerErrorResponse();
  }

  return NextResponse.json({
    ok: true as const,
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
