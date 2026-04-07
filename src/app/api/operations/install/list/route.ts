import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.OPERATIONS_HEAD, UserRole.INSTALLATION_TEAM]);
  if (session instanceof NextResponse) return session;

  const rows = await (prisma as any).installation.findMany({
    where: session.role === UserRole.INSTALLATION_TEAM ? { companyId: session.companyId, assignedTo: session.sub } : { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { lead: { select: { id: true, name: true, phone: true } }, assignee: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ ok: true as const, installations: rows.map((r: any) => ({ ...r, createdAt: r.createdAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null })) });
}
