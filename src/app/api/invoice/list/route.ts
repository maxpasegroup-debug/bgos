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

export async function GET(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const rows = await prisma.invoice.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { name: true, phone: true } },
      quotation: { select: { customerName: true, customerPhone: true } },
    },
  });

  return NextResponse.json({
    ok: true as const,
    invoices: rows.map((inv) => {
      const displayStatus = resolveInvoiceStatus({
        status: inv.status,
        paidAmount: inv.paidAmount,
        totalAmount: inv.totalAmount,
        dueDate: inv.dueDate,
      });
      const { customerName, customerPhone } = resolveInvoiceCustomer(inv);
      const balance = roundMoney(Math.max(0, inv.totalAmount - inv.paidAmount));
      return {
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
      };
    }),
  });
}
