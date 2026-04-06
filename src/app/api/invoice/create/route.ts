import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
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

  const { quotationId } = parsed.data;

  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, companyId: session.companyId },
  });

  if (!quotation) {
    return NextResponse.json(
      { ok: false as const, error: "Quotation not found", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }

  if (quotation.status !== "APPROVED") {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Quotation must be APPROVED before creating an invoice",
        code: "INVALID_STATE" as const,
      },
      { status: 409 },
    );
  }

  const dup = await prisma.invoice.findFirst({
    where: { companyId: session.companyId, quotationId },
    select: { id: true, invoiceNumber: true },
  });
  if (dup) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Invoice already exists for this quotation",
        code: "DUPLICATE" as const,
        invoiceId: dup.id,
        invoiceNumber: dup.invoiceNumber,
      },
      { status: 409 },
    );
  }

  const items = parseItemsJson(quotation.items);
  if (!items) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid quotation line items", code: "DATA" as const },
      { status: 500 },
    );
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

  return NextResponse.json({
    ok: true as const,
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
