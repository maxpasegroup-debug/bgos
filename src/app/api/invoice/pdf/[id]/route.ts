import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { companyCurrentApiSelect, type CompanyCurrentApiRow } from "@/lib/company-db-select";
import { parseItemsJson, resolveInvoiceStatus } from "@/lib/money-items";
import { buildInvoicePdf } from "@/lib/pdf-money";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;

  const [inv, company] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id, companyId: session.companyId },
    }),
    prisma.company.findUnique({
      where: { id: session.companyId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: companyCurrentApiSelect as any,
    }) as Promise<CompanyCurrentApiRow | null>,
  ]);

  if (!inv || !company) {
    return NextResponse.json(
      { ok: false as const, error: "Not found", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }

  const items = parseItemsJson(inv.items);
  if (!items) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid items on invoice", code: "DATA" as const },
      { status: 500 },
    );
  }

  const displayStatus = resolveInvoiceStatus({
    status: inv.status,
    paidAmount: inv.paidAmount,
    totalAmount: inv.totalAmount,
    dueDate: inv.dueDate,
  });

  const pdf = await buildInvoicePdf({
    company,
    docNumber: inv.invoiceNumber,
    docDate: inv.createdAt,
    dueDate: inv.dueDate,
    items,
    totalAmount: inv.totalAmount,
    paidAmount: inv.paidAmount,
    status: displayStatus,
  });

  const filename = `${inv.invoiceNumber.replace(/[/\\?%*:|"<>]/g, "-")}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
