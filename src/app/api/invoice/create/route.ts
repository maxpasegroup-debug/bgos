import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { parseItemsJson, resolveInvoiceStatus, roundMoney } from "@/lib/money-items";
import { nextInvoiceNumber } from "@/lib/money-numbers";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

const bodySchema = z.object({
  quotationId: z.string(),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { quotationId } = parsed.data;

  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, companyId: session.companyId },
  });

  if (!quotation) {
    return jsonError(404, "NOT_FOUND", "Quotation not found");
  }

  if (quotation.status !== "APPROVED") {
    return jsonError(409, "INVALID_STATE", "Quotation must be APPROVED before creating an invoice");
  }

  const dup = await prisma.invoice.findFirst({
    where: { companyId: session.companyId, quotationId },
    select: { id: true, invoiceNumber: true },
  });
  if (dup) {
    return jsonError(409, "DUPLICATE", "Invoice already exists for this quotation", {
      invoiceId: dup.id,
      invoiceNumber: dup.invoiceNumber,
    });
  }

  const items = parseItemsJson(quotation.items);
  if (!items) {
    return jsonError(500, "DATA", "Invalid quotation line items");
  }

  const invoiceNumber = await nextInvoiceNumber(session.companyId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  dueDate.setHours(23, 59, 59, 999);

  const totalAmount = roundMoney(quotation.totalAmount);

  const inv = await prisma.invoice.create({
    data: {
      companyId: session.companyId,
      quotationId,
      leadId: quotation.leadId,
      invoiceNumber,
      status: "SENT",
      totalAmount,
      paidAmount: 0,
      dueDate,
      items,
    },
  });

  const displayStatus = resolveInvoiceStatus({
    status: inv.status,
    paidAmount: inv.paidAmount,
    totalAmount: inv.totalAmount,
    dueDate: inv.dueDate,
  });

  return jsonSuccess({
    invoice: {
      id: inv.id,
      companyId: inv.companyId,
      quotationId: inv.quotationId,
      leadId: inv.leadId,
      invoiceNumber: inv.invoiceNumber,
      status: displayStatus,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      dueDate: inv.dueDate?.toISOString() ?? null,
      items: inv.items,
      createdAt: inv.createdAt.toISOString(),
    },
  });
}
