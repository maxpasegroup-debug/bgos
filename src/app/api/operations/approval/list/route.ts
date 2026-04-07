import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.PRO, UserRole.OPERATIONS_HEAD]);
  if (session instanceof NextResponse) return session;

  const rows = await (prisma as any).approval.findMany({ where: { companyId: session.companyId }, orderBy: { createdAt: "desc" }, take: 200, include: { lead: { select: { id: true, name: true, phone: true } } } });
  return NextResponse.json({ ok: true as const, approvals: rows.map((r: any) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
}
