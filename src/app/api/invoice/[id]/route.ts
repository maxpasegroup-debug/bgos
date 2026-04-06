import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { resolveInvoiceCustomer } from "@/lib/invoice-customer";
import {
  invoicePaymentBucket,
  resolveInvoiceStatus,
  roundMoney,
} from "@/lib/money-items";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;

  const inv = await prisma.invoice.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      payments: { orderBy: { date: "desc" } },
      lead: { select: { name: true, phone: true } },
      quotation: { select: { customerName: true, customerPhone: true } },
    },
  });

  if (!inv) {
    return NextResponse.json(
      { ok: false as const, error: "Invoice not found", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }

  const displayStatus = resolveInvoiceStatus({
    status: inv.status,
    paidAmount: inv.paidAmount,
    totalAmount: inv.totalAmount,
    dueDate: inv.dueDate,
  });

  const { customerName, customerPhone } = resolveInvoiceCustomer(inv);
  const balance = roundMoney(Math.max(0, inv.totalAmount - inv.paidAmount));

  return NextResponse.json({
    ok: true as const,
    invoice: {
      id: inv.id,
      companyId: inv.companyId,
      quotationId: inv.quotationId,
      leadId: inv.leadId,
      customerName,
      customerPhone,
      invoiceNumber: inv.invoiceNumber,
      status: displayStatus,
      paymentBucket: invoicePaymentBucket(displayStatus),
      workflowStatus: inv.status,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      balance,
      dueDate: inv.dueDate?.toISOString() ?? null,
      items: inv.items,
      createdAt: inv.createdAt.toISOString(),
      payments: inv.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        date: p.date.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
    },
  });
}
