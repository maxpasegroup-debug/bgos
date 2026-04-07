import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { companyCurrentApiSelect, type CompanyCurrentApiRow } from "@/lib/company-db-select";
import { parseItemsJson } from "@/lib/money-items";
import { buildQuotationPdf, pdfAttachmentFilename } from "@/lib/pdf-money";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;

  const [q, company] = await Promise.all([
    prisma.quotation.findFirst({
      where: { id, companyId: session.companyId },
    }),
    prisma.company.findUnique({
      where: { id: session.companyId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: companyCurrentApiSelect as any,
    }) as Promise<CompanyCurrentApiRow | null>,
  ]);

  if (!q || !company) {
    return NextResponse.json(
      { ok: false as const, error: "Not found", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }

  const items = parseItemsJson(q.items);
  if (!items) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid items on quotation", code: "DATA" as const },
      { status: 500 },
    );
  }

  const pdf = await buildQuotationPdf({
    company,
    docNumber: q.quotationNumber,
    docDate: q.createdAt,
    items,
    totalAmount: q.totalAmount,
    notes: q.notes,
    customerName: (q as { customerName?: string | null }).customerName,
    customerPhone: (q as { customerPhone?: string | null }).customerPhone,
    customerAddress: null,
  });

  const filename = pdfAttachmentFilename("quotation", q.quotationNumber);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
