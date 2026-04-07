import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { syncLeadAndDealOnInvoicePaid } from "@/lib/crm-money-sync";
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

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { invoiceId, amount, method, date: dateRaw } = parsed.data;
  const payDate = dateRaw ? new Date(dateRaw) : new Date();
  if (Number.isNaN(payDate.getTime())) {
    return jsonError(400, "VALIDATION", "Invalid date");
  }

  const roundedAmount = roundMoney(amount);

  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId: session.companyId },
  });
  if (!inv) {
    return jsonError(404, "NOT_FOUND", "Invoice not found");
  }
  if (inv.status === "DRAFT") {
    return jsonError(409, "INVALID_STATE", "Cannot record payment on a draft invoice");
  }
  if (inv.paidAmount >= inv.totalAmount - 1e-9) {
    return jsonError(409, "ALREADY_PAID", "Invoice is already fully paid");
  }
  const balance = roundMoney(inv.totalAmount - inv.paidAmount);
  if (roundedAmount > balance + 1e-9) {
    return jsonError(409, "OVERPAY", "Payment would exceed invoice total", { maxAmount: balance });
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
    return jsonError(404, "NOT_FOUND", "Invoice not found after payment");
  }

  const displayStatus = resolveInvoiceStatus({
    status: refreshed.status,
    paidAmount: refreshed.paidAmount,
    totalAmount: refreshed.totalAmount,
    dueDate: refreshed.dueDate,
  });

  const { customerName, customerPhone } = resolveInvoiceCustomer(refreshed);
  const newBalance = roundMoney(Math.max(0, refreshed.totalAmount - refreshed.paidAmount));

  if (displayStatus === "PAID" && refreshed.leadId) {
    await syncLeadAndDealOnInvoicePaid(
      session.companyId,
      refreshed.leadId,
      refreshed.totalAmount,
    );
  }

  return jsonSuccess({
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
