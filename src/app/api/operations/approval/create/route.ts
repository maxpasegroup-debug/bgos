import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({ leadId: z.string().cuid(), notes: z.string().max(3000).optional() });

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.PRO, UserRole.OPERATIONS_HEAD]);
  if (session instanceof NextResponse) return session;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });

  const lead = await prisma.lead.findFirst({ where: { id: body.data.leadId, companyId: session.companyId } });
  if (!lead) return NextResponse.json({ ok: false as const, error: "Lead not found", code: "NOT_FOUND" }, { status: 404 });

  const row = await (prisma as any).approval.upsert({
    where: { companyId_leadId: { companyId: session.companyId, leadId: body.data.leadId } },
    update: { ...(body.data.notes ? { notes: body.data.notes } : {}) },
    create: { companyId: session.companyId, leadId: body.data.leadId, status: "PENDING", ...(body.data.notes ? { notes: body.data.notes } : {}) },
  });

  return NextResponse.json({ ok: true as const, approval: { ...row, createdAt: row.createdAt.toISOString() } });
}
