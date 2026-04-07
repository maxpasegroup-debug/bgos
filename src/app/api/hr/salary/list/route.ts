import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithCompany } from "@/lib/auth";
import { isHrManagerRole } from "@/lib/hr";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const sp = request.nextUrl.searchParams;
  const month = sp.get("month")?.trim();
  const userId = sp.get("userId")?.trim();

  const where: {
    companyId: string;
    month?: string;
    userId?: string;
  } = { companyId: session.companyId };

  if (month) where.month = month;
  if (isHrManagerRole(session.role)) {
    if (userId) where.userId = userId;
  } else {
    where.userId = session.sub;
  }

  const rows = await (prisma as any).salary.findMany({
    where,
    orderBy: [{ month: "desc" }, { amount: "desc" }],
    take: 200,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    ok: true as const,
    salaries: rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      userEmail: r.user.email,
      amount: r.amount,
      month: r.month,
    })),
  });
}
