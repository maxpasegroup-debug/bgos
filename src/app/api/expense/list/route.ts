import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

/** `monthly` query: YYYY-MM */
export async function GET(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const monthly = request.nextUrl.searchParams.get("monthly");
  const category = request.nextUrl.searchParams.get("category");

  const where: {
    companyId: string;
    date?: { gte: Date; lte: Date };
    category?: string;
  } = { companyId: session.companyId };

  if (monthly && /^\d{4}-\d{2}$/.test(monthly)) {
    const [y, m] = monthly.split("-").map((x) => parseInt(x, 10));
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    where.date = { gte: start, lte: end };
  }

  if (category?.trim()) {
    where.category = category.trim();
  }

  const rows = await prisma.expense.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    ok: true as const,
    expenses: rows.map((e) => ({
      id: e.id,
      title: e.title,
      amount: e.amount,
      category: e.category,
      date: e.date.toISOString(),
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
