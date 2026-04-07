import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithRoles } from "@/lib/auth";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_SET } from "@/lib/expense-categories";
import { roundMoney } from "@/lib/money-items";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKeyStr: string): string {
  const [y, m] = monthKeyStr.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

const querySchema = z.object({
  monthly: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

/**
 * Category split for a month + 6-month bar series + high-spend threshold (for list UX).
 */
export async function GET(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const q = querySchema.safeParse(raw);
  if (!q.success) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid query", code: "VALIDATION" as const },
      { status: 400 },
    );
  }

  const now = new Date();
  const targetMonth =
    q.data.monthly ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = targetMonth.split("-").map((x) => parseInt(x, 10));
  const rangeStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const rangeEnd = new Date(y, m, 0, 23, 59, 59, 999);

  const trendStart = startOfMonth(addMonths(now, -5));
  const trendEnd = endOfMonth(now);

  const [monthGrouped, monthRows, trendRows] = await Promise.all([
    prisma.expense.groupBy({
      by: ["category"],
      where: { companyId: session.companyId, date: { gte: rangeStart, lte: rangeEnd } },
      _sum: { amount: true },
    }),
    prisma.expense.findMany({
      where: { companyId: session.companyId, date: { gte: rangeStart, lte: rangeEnd } },
      select: { amount: true },
    }),
    prisma.expense.findMany({
      where: { companyId: session.companyId, date: { gte: trendStart, lte: trendEnd } },
      select: { amount: true, date: true },
    }),
  ]);

  const byCategory = monthGrouped
    .map((g) => ({
      category: g.category,
      total: roundMoney(g._sum.amount ?? 0),
    }))
    .filter((x) => x.total > 1e-9)
    .sort((a, b) => b.total - a.total);

  const monthTotal = roundMoney(byCategory.reduce((s, x) => s + x.total, 0));

  const amounts = monthRows.map((r) => r.amount).sort((a, b) => a - b);
  let highThreshold = 0;
  if (amounts.length > 0) {
    const p75 = amounts[Math.min(amounts.length - 1, Math.floor(amounts.length * 0.75))];
    highThreshold = roundMoney(Math.max(p75 ?? 0, monthTotal * 0.12));
  }

  const barKeys: string[] = [];
  for (let i = 0; i < 6; i++) {
    barKeys.push(monthKey(startOfMonth(addMonths(now, -(5 - i)))));
  }
  const barBucket = new Map<string, number>();
  for (const k of barKeys) barBucket.set(k, 0);
  for (const r of trendRows) {
    const k = monthKey(r.date);
    if (!barBucket.has(k)) continue;
    barBucket.set(k, roundMoney((barBucket.get(k) ?? 0) + r.amount));
  }
  const monthlyBars = barKeys.map((k) => ({
    monthKey: k,
    label: monthLabel(k),
    total: roundMoney(barBucket.get(k) ?? 0),
  }));

  const categoryTotals: Record<string, number> = {};
  for (const c of EXPENSE_CATEGORIES) categoryTotals[c] = 0;
  for (const row of byCategory) {
    if (EXPENSE_CATEGORY_SET.has(row.category)) {
      categoryTotals[row.category] = row.total;
    } else {
      categoryTotals.Misc = roundMoney((categoryTotals.Misc ?? 0) + row.total);
    }
  }

  return NextResponse.json({
    ok: true as const,
    monthKey: targetMonth,
    monthTotal,
    byCategory,
    categoryTotals,
    monthlyBars,
    highThreshold,
  });
}
