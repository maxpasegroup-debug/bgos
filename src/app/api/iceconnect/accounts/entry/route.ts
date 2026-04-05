import { PaymentStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  amount: z.number().positive(),
  status: z.nativeEnum(PaymentStatus).optional().default(PaymentStatus.PENDING),
});

export async function POST(request: NextRequest) {
  const session = requireIceconnectRole(request, [UserRole.ACCOUNTS]);
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const payment = await prisma.payment.create({
    data: {
      amount: parsed.data.amount,
      status: parsed.data.status,
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
}
