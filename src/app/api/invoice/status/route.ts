import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithRoles } from "@/lib/auth";
import { resolveInvoiceStatus } from "@/lib/money-items";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

const patchBodySchema = z.object({
  id: z.string(),
  status: z.enum(["DRAFT", "SENT", "PAID"]),
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

  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid body", code: "VALIDATION" as const },
      { status: 400 },
    );
  }

  const { id, status } = parsed.data;

  const existing = await prisma.invoice.findFirst({
    where: { id, companyId: session.companyId },
  });
  if (!existing) {
    return NextResponse.json(
      { ok: false as const, error: "Invoice not found", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }

  if (status === "PAID" && existing.paidAmount < existing.totalAmount - 1e-9) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Cannot mark PAID until paid amount matches total",
        code: "INVALID_STATE" as const,
      },
      { status: 409 },
    );
  }

  const inv = await prisma.invoice.update({
    where: { id },
    data: { status },
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
      workflowStatus: inv.status,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      dueDate: inv.dueDate?.toISOString() ?? null,
      items: inv.items,
      createdAt: inv.createdAt.toISOString(),
    },
  });
}
