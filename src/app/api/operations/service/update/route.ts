import { ServiceTicketStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({ id: z.string().cuid(), status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]), notes: z.string().max(3000).optional() });

export async function PATCH(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.OPERATIONS_HEAD, UserRole.SERVICE_TEAM]);
  if (session instanceof NextResponse) return session;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });

  const row = await (prisma as any).serviceTicket.findFirst({ where: { id: body.data.id, companyId: session.companyId } });
  if (!row) return NextResponse.json({ ok: false as const, error: "Ticket not found", code: "NOT_FOUND" }, { status: 404 });
  if (session.role === UserRole.SERVICE_TEAM && row.assignedTo !== session.sub) return NextResponse.json({ ok: false as const, error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });

  const mapped = body.data.status === "CLOSED" ? ServiceTicketStatus.RESOLVED : ServiceTicketStatus.OPEN;
  const updated = await (prisma as any).serviceTicket.update({ where: { id: row.id }, data: { status: mapped, ...(body.data.notes !== undefined ? { description: body.data.notes } : {}), ...(body.data.status === "CLOSED" ? { resolvedAt: new Date() } : {}) } });

  return NextResponse.json({ ok: true as const, serviceTicket: { ...updated, uiStatus: body.data.status, createdAt: updated.createdAt.toISOString(), resolvedAt: updated.resolvedAt?.toISOString() ?? null } });
}
