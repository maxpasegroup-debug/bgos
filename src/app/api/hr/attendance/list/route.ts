import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithCompany } from "@/lib/auth";
import { isHrManagerRole, startOfDayLocal } from "@/lib/hr";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const sp = request.nextUrl.searchParams;
  const userId = sp.get("userId")?.trim();
  const dateParam = sp.get("date")?.trim();

  const where: {
    companyId: string;
    userId?: string;
    date?: Date;
  } = { companyId: session.companyId };

  if (isHrManagerRole(session.role)) {
    if (userId) where.userId = userId;
  } else {
    where.userId = session.sub;
  }

  if (dateParam) {
    const d = new Date(dateParam);
    if (!Number.isNaN(d.getTime())) where.date = startOfDayLocal(d);
  }

  const rows = await (prisma as any).attendance.findMany({
    where,
    orderBy: { date: "desc" },
    take: 200,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    ok: true as const,
    attendance: rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      userEmail: r.user.email,
      date: r.date.toISOString(),
      checkIn: r.checkIn?.toISOString() ?? null,
      checkOut: r.checkOut?.toISOString() ?? null,
    })),
  });
}
