import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  partnerId: z.string().cuid(),
  leadId: z.string().cuid(),
  amount: z.number().finite().positive(),
  type: z.enum(["DIRECT", "REFERRAL"]),
  status: z.enum(["PENDING", "PAID"]).optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.SALES_HEAD, UserRole.ACCOUNTANT]);
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try { json = await request.json(); } catch {
    return NextResponse.json({ ok: false as const, error: "Invalid JSON", code: "BAD_REQUEST" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });
  }

  const p = parsed.data;
  const lead = await (prisma as any).lead.findFirst({
    where: { id: p.leadId, companyId: session.companyId },
    select: { id: true, partnerId: true },
  });
  if (!lead) {
    return NextResponse.json({ ok: false as const, error: "Lead not found", code: "NOT_FOUND" }, { status: 404 });
  }
  if (lead.partnerId !== p.partnerId) {
    return NextResponse.json({ ok: false as const, error: "Partner must be linked to lead", code: "PARTNER_NOT_LINKED" }, { status: 400 });
  }

  const partner = await (prisma as any).channelPartner.findFirst({
    where: { id: p.partnerId, companyId: session.companyId },
    select: { id: true },
  });
  if (!partner) {
    return NextResponse.json({ ok: false as const, error: "Partner not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const row = await (prisma as any).commission.upsert({
    where: {
      companyId_leadId: {
        companyId: session.companyId,
        leadId: p.leadId,
      },
    },
    update: {
      partnerId: p.partnerId,
      amount: p.amount,
      type: p.type,
      status: p.status ?? "PENDING",
    },
    create: {
      companyId: session.companyId,
      partnerId: p.partnerId,
      leadId: p.leadId,
      amount: p.amount,
      type: p.type,
      status: p.status ?? "PENDING",
    },
  });

  return NextResponse.json({
    ok: true as const,
    commission: {
      id: row.id,
      partnerId: row.partnerId,
      leadId: row.leadId,
      amount: row.amount,
      type: row.type,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    },
  });
}
