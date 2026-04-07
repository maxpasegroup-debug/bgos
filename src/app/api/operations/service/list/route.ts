import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.OPERATIONS_HEAD, UserRole.SERVICE_TEAM]);
  if (session instanceof NextResponse) return session;

  const rows = await (prisma as any).serviceTicket.findMany({
    where: session.role === UserRole.SERVICE_TEAM ? { companyId: session.companyId, assignedTo: session.sub } : { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { lead: { select: { id: true, name: true, phone: true } }, assignee: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ ok: true as const, serviceTickets: rows.map((r: any) => ({ ...r, uiStatus: r.status === "RESOLVED" ? "CLOSED" : "OPEN", createdAt: r.createdAt.toISOString(), resolvedAt: r.resolvedAt?.toISOString() ?? null })) });
}
