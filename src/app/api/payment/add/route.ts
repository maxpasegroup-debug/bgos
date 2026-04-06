import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithRoles } from "@/lib/auth";
import { resolveInvoiceCustomer } from "@/lib/invoice-customer";
import { invoicePaymentBucket, resolveInvoiceStatus, roundMoney } from "@/lib/money-items";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

const bodySchema = z.object({
  invoiceId: z.string(),
  amount: z.number().finite().positive(),
  method: z.string().trim().min(1).max(120),
  date: z.string().optional(),
});

export async function POST(request: NextRequest) {
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

  const { invoiceId, amount, method, date: dateRaw } = parsed.data;
  const payDate = dateRaw ? new Date(dateRaw) : new Date();
  if (Number.isNaN(payDate.getTime())) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid date", code: "VALIDATION" as const },
      { status: 400 },
    );
  }

  const roundedAmount = roundMoney(amount);

  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId: session.companyId },
  });
  if (!inv) {
    return NextResponse.json(
      { ok: false as const, error: "Invoice not found", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }
  if (inv.status === "DRAFT") {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Cannot record payment on a draft invoice",
        code: "INVALID_STATE" as const,
      },
      { status: 409 },
    );
  }
  if (inv.paidAmount >= inv.totalAmount - 1e-9) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Invoice is already fully paid",
        code: "ALREADY_PAID" as const,
      },
      { status: 409 },
    );
  }
  const balance = roundMoney(inv.totalAmount - inv.paidAmount);
  if (roundedAmount > balance + 1e-9) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Payment would exceed invoice total",
        code: "OVERPAY" as const,
        maxAmount: balance,
      },
      { status: 409 },
    );
  }

  const newPaid = roundMoney(inv.paidAmount + roundedAmount);
  const newStatus = resolveInvoiceStatus({
    status: inv.status,
    paidAmount: newPaid,
    totalAmount: inv.totalAmount,
    dueDate: inv.dueDate,
  });

  await prisma.$transaction([
    prisma.invoicePayment.create({
      data: {
        companyId: session.companyId,
        invoiceId,
        amount: roundedAmount,
        method,
        date: payDate,
      },
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount: newPaid, status: newStatus },
    }),
  ]);

  const refreshed = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId: session.companyId },
    include: {
      payments: { orderBy: { date: "desc" } },
      lead: { select: { name: true, phone: true } },
      quotation: { select: { customerName: true, customerPhone: true } },
    },
  });

  if (!refreshed) {
    return NextResponse.json(
      { ok: false as const, error: "Invoice not found after payment", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }

  const displayStatus = resolveInvoiceStatus({
    status: refreshed.status,
    paidAmount: refreshed.paidAmount,
    totalAmount: refreshed.totalAmount,
    dueDate: refreshed.dueDate,
  });

  const { customerName, customerPhone } = resolveInvoiceCustomer(refreshed);
  const newBalance = roundMoney(Math.max(0, refreshed.totalAmount - refreshed.paidAmount));

  return NextResponse.json({
    ok: true as const,
    paymentAmount: roundedAmount,
    invoice: {
      id: refreshed.id,
      companyId: refreshed.companyId,
      quotationId: refreshed.quotationId,
      leadId: refreshed.leadId,
      customerName,
      customerPhone,
      invoiceNumber: refreshed.invoiceNumber,
      status: displayStatus,
      paymentBucket: invoicePaymentBucket(displayStatus),
      workflowStatus: refreshed.status,
      totalAmount: refreshed.totalAmount,
      paidAmount: refreshed.paidAmount,
      balance: newBalance,
      dueDate: refreshed.dueDate?.toISOString() ?? null,
      items: refreshed.items,
      createdAt: refreshed.createdAt.toISOString(),
      payments: refreshed.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        date: p.date.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
    },
  });
}
