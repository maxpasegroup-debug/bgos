import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithRoles } from "@/lib/auth";
import { moneyItemsSchema, normalizeMoneyItems, totalFromNormalized } from "@/lib/money-items";
import { nextQuotationNumber } from "@/lib/money-numbers";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

const bodySchema = z.object({
  leadId: z.string().optional().nullable(),
  customerName: z.string().trim().max(200).optional().nullable(),
  customerPhone: z.string().trim().max(32).optional().nullable(),
  items: moneyItemsSchema,
  notes: z.string().max(8000).optional().nullable(),
  status: z.enum(["DRAFT", "SENT"]).optional().default("DRAFT"),
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

  const { leadId, customerName, customerPhone, items, notes, status } = parsed.data;
  let nameOut = customerName?.trim() || null;
  let phoneOut = customerPhone?.trim() || null;

  if (leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, companyId: session.companyId },
      select: { id: true, name: true, phone: true },
    });
    if (!lead) {
      return NextResponse.json(
        { ok: false as const, error: "Lead not found", code: "NOT_FOUND" as const },
        { status: 404 },
      );
    }
    if (!nameOut) nameOut = lead.name.trim();
    if (!phoneOut) phoneOut = lead.phone.trim();

    const existingForLead = await prisma.quotation.findFirst({
      where: {
        companyId: session.companyId,
        leadId,
        status: { not: "REJECTED" },
      },
      select: { id: true, quotationNumber: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    if (existingForLead) {
      return NextResponse.json(
        {
          ok: false as const,
          error:
            "This lead already has an active quotation. One quotation per lead — reject the old one or continue from Money.",
          code: "DUPLICATE_QUOTATION" as const,
          quotationId: existingForLead.id,
          quotationNumber: existingForLead.quotationNumber,
        },
        { status: 409 },
      );
    }
  }

  if (!leadId && (!nameOut || !phoneOut)) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Customer name and phone are required when no lead is linked",
        code: "VALIDATION" as const,
      },
      { status: 400 },
    );
  }

  const normalized = normalizeMoneyItems(items);
  const totalAmount = totalFromNormalized(normalized);
  const quotationNumber = await nextQuotationNumber(session.companyId);

  const q = await prisma.quotation.create({
    data: {
      companyId: session.companyId,
      leadId: leadId ?? null,
      customerName: nameOut,
      customerPhone: phoneOut,
      quotationNumber,
      status,
      totalAmount,
      items: normalized,
      notes: notes?.trim() || null,
      // Prisma types refresh after `npx prisma generate` (may fail on Windows EPERM).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  return NextResponse.json({
    ok: true as const,
    quotation: {
      id: q.id,
      companyId: q.companyId,
      leadId: q.leadId,
      customerName: (q as { customerName?: string | null }).customerName ?? null,
      customerPhone: (q as { customerPhone?: string | null }).customerPhone ?? null,
      quotationNumber: q.quotationNumber,
      status: q.status,
      totalAmount: q.totalAmount,
      items: q.items,
      notes: q.notes,
      createdAt: q.createdAt.toISOString(),
    },
  });
}
