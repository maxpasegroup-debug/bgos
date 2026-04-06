import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const invoiceId = request.nextUrl.searchParams.get("invoiceId");

  const rows = await prisma.invoicePayment.findMany({
    where: {
      companyId: session.companyId,
      ...(invoiceId ? { invoiceId } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      invoice: { select: { invoiceNumber: true } },
    },
  });

  return NextResponse.json({
    ok: true as const,
    payments: rows.map((p) => ({
      id: p.id,
      companyId: p.companyId,
      invoiceId: p.invoiceId,
      invoiceNumber: p.invoice.invoiceNumber,
      amount: p.amount,
      method: p.method,
      date: p.date.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
