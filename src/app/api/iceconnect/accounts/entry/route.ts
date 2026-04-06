import { PaymentStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  amount: z
    .number()
    .finite()
    .positive()
    .max(1e12, "Amount too large"),
  status: z.nativeEnum(PaymentStatus).optional().default(PaymentStatus.PENDING),
});

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.ACCOUNTS]);
  if (session instanceof NextResponse) return session;

  const body = await parseJsonBodyZod(request, bodySchema);
  if (!body.ok) return body.response;

  try {
    const payment = await prisma.payment.create({
      data: {
        amount: body.data.amount,
        status: body.data.status,
        companyId: session.companyId,
      },
    });

    return NextResponse.json(
      {
        ok: true as const,
        payment: {
          id: payment.id,
          amount: payment.amount,
          status: payment.status,
          createdAt: payment.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST /api/iceconnect/accounts/entry", e);
  }
}
