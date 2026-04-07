import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithCompany } from "@/lib/auth";
import { isHrManagerRole } from "@/lib/hr";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status")?.trim();
  const userId = sp.get("userId")?.trim();

  const where: {
    companyId: string;
    status?: string;
    userId?: string;
  } = { companyId: session.companyId };

  if (status) where.status = status;
  if (isHrManagerRole(session.role)) {
    if (userId) where.userId = userId;
  } else {
    where.userId = session.sub;
  }

  const rows = await (prisma as any).leaveRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    ok: true as const,
    leaves: rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      userEmail: r.user.email,
      fromDate: r.fromDate.toISOString(),
      toDate: r.toDate.toISOString(),
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
