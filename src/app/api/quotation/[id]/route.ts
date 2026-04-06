import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;

  const q = await prisma.quotation.findFirst({
    where: { id, companyId: session.companyId },
  });

  if (!q) {
    return NextResponse.json(
      { ok: false as const, error: "Quotation not found", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }

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
