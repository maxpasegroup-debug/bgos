import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const leadId = request.nextUrl.searchParams.get("leadId");

  const rows = await prisma.quotation.findMany({
    where: {
      companyId: session.companyId,
      ...(leadId ? { leadId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    ok: true as const,
    quotations: rows.map((q) => ({
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
    })),
  });
}
