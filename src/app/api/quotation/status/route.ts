import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithRoles } from "@/lib/auth";
import { QUOTATION_STATUSES } from "@/lib/money-items";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

const bodySchema = z.object({
  id: z.string(),
  status: z.enum(QUOTATION_STATUSES),
});

export async function PATCH(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Invalid JSON", code: "BAD_REQUEST" as const },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid body", code: "VALIDATION" as const },
      { status: 400 },
    );
  }

  const { id, status } = parsed.data;

  const existing = await prisma.quotation.findFirst({
    where: { id, companyId: session.companyId },
  });
  if (!existing) {
    return NextResponse.json(
      { ok: false as const, error: "Quotation not found", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }

  const q = await prisma.quotation.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({
    ok: true as const,
    quotation: {
      id: q.id,
      companyId: q.companyId,
      leadId: q.leadId,
      customerName: (q as { customerName?: string | null }).customerName ?? null,
      customerPhone: (q as { customerPhone?: string | null }).customerPhone ?? null,
      quotationNumber: q.quotationNumber,
      status: q.status,
      totalAmount: q.totalAmount,
      items: q.items,
      notes: q.notes,
      createdAt: q.createdAt.toISOString(),
    },
  });
}
