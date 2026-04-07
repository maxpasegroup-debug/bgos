import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.OPERATIONS_HEAD, UserRole.SITE_ENGINEER]);
  if (session instanceof NextResponse) return session;

  const rows = await (prisma as any).siteVisit.findMany({
    where: session.role === UserRole.SITE_ENGINEER ? { companyId: session.companyId, assignedTo: session.sub } : { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { lead: { select: { id: true, name: true, phone: true } }, assignee: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ ok: true as const, siteVisits: rows.map((r: any) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
}
