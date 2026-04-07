import { LeadStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({ id: z.string().cuid(), status: z.enum(["SCHEDULED", "COMPLETED"]), report: z.any().optional() });

export async function PATCH(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.OPERATIONS_HEAD, UserRole.SITE_ENGINEER]);
  if (session instanceof NextResponse) return session;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });

  const row = await (prisma as any).siteVisit.findFirst({ where: { id: body.data.id, companyId: session.companyId } });
  if (!row) return NextResponse.json({ ok: false as const, error: "Site visit not found", code: "NOT_FOUND" }, { status: 404 });
  if (session.role === UserRole.SITE_ENGINEER && row.assignedTo !== session.sub) return NextResponse.json({ ok: false as const, error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });

  const updated = await (prisma as any).siteVisit.update({ where: { id: row.id }, data: { status: body.data.status, ...(body.data.report !== undefined ? { report: body.data.report } : {}) } });
  if (body.data.status === "COMPLETED") {
    await prisma.lead.update({ where: { id: row.leadId }, data: { status: LeadStatus.SITE_VISIT_COMPLETED } });
    await (prisma as any).approval.upsert({ where: { companyId_leadId: { companyId: session.companyId, leadId: row.leadId } }, update: {}, create: { companyId: session.companyId, leadId: row.leadId, status: "PENDING" } });
  }
  return NextResponse.json({ ok: true as const, siteVisit: { ...updated, createdAt: updated.createdAt.toISOString() } });
}
