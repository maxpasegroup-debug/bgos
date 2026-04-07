import { LeadStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({ id: z.string().cuid(), status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]), notes: z.string().max(3000).optional() });

export async function PATCH(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.OPERATIONS_HEAD, UserRole.INSTALLATION_TEAM]);
  if (session instanceof NextResponse) return session;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });

  const row = await (prisma as any).installation.findFirst({ where: { id: body.data.id, companyId: session.companyId } });
  if (!row) return NextResponse.json({ ok: false as const, error: "Installation not found", code: "NOT_FOUND" }, { status: 404 });
  if (session.role === UserRole.INSTALLATION_TEAM && row.assignedTo !== session.sub) return NextResponse.json({ ok: false as const, error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });

  const updated = await (prisma as any).installation.update({ where: { id: row.id }, data: { status: body.data.status, ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}), ...(body.data.status === "COMPLETED" ? { completedAt: new Date() } : {}) } });
  if (body.data.status === "COMPLETED" && row.leadId) {
    await prisma.lead.update({ where: { id: row.leadId }, data: { status: LeadStatus.WON } });
  }
  return NextResponse.json({ ok: true as const, installation: { ...updated, createdAt: updated.createdAt.toISOString(), completedAt: updated.completedAt?.toISOString() ?? null } });
}
