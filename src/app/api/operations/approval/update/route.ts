import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({ id: z.string().cuid(), status: z.enum(["PENDING", "APPROVED", "REJECTED"]), notes: z.string().max(3000).optional() });

export async function PATCH(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.PRO, UserRole.OPERATIONS_HEAD]);
  if (session instanceof NextResponse) return session;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });

  const row = await (prisma as any).approval.findFirst({ where: { id: body.data.id, companyId: session.companyId } });
  if (!row) return NextResponse.json({ ok: false as const, error: "Approval not found", code: "NOT_FOUND" }, { status: 404 });

  const updated = await (prisma as any).approval.update({ where: { id: row.id }, data: { status: body.data.status, ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}) } });

  if (body.data.status === "APPROVED") {
    await (prisma as any).installation.upsert({
      where: { companyId_leadId: { companyId: session.companyId, leadId: row.leadId } },
      update: { status: "PENDING" },
      create: { companyId: session.companyId, leadId: row.leadId, assignedTo: null, status: "PENDING" },
    });
  }

  return NextResponse.json({ ok: true as const, approval: { ...updated, createdAt: updated.createdAt.toISOString() } });
}
