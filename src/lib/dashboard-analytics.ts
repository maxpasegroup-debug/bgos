import "server-only";

import { LeadStatus } from "@prisma/client";
import { roundMoney } from "@/lib/money-items";
import { prisma } from "@/lib/prisma";
import type { DashboardAnalytics, DashboardAnalyticsTrendPoint } from "@/types";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function dayLabelFromKey(key: string): string {
  const [y, mo, da] = key.split("-").map(Number);
  if (!y || !mo || !da) return key;
  const d = new Date(y, mo - 1, da);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function daysBetween(start: Date, end: Date): number {
  const a = startOfDayMs(start);
  const b = startOfDayMs(end);
  return Math.ceil((b - a) / 86400000) + 1;
}

function startOfDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Use daily buckets for shorter ranges, monthly for longer (and all_time capped). */
function shouldUseDailyBuckets(start: Date, end: Date): boolean {
  return daysBetween(start, end) <= 45;
}

function enumerateDayKeys(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last) {
    out.push(dayKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1, 0, 0, 0, 0);
}

function enumerateMonthKeys(start: Date, end: Date, maxMonths = 120): string[] {
  const out: string[] = [];
  let cur = startOfMonth(start);
  const endM = startOfMonth(end);
  let n = 0;
  while (cur <= endM && n < maxMonths) {
    out.push(monthKey(cur));
    cur = addMonths(cur, 1);
    n += 1;
  }
  return out;
}

/** Last `count` calendar months ending at `end` (inclusive), oldest-first. */
function trailingMonthKeysEndAt(end: Date, count: number): string[] {
  const out: string[] = [];
  let cur = startOfMonth(end);
  for (let i = 0; i < count; i++) {
    out.unshift(monthKey(cur));
    cur = addMonths(cur, -1);
  }
  return out;
}

/**
 * KPIs for `kpiStart`…`kpiEnd` and a trend series for `trendStart`…`trendEnd`
 * (allows "all time" KPIs with a bounded chart).
 */
export async function computeDashboardAnalytics(
  companyId: string,
  kpiStart: Date,
  kpiEnd: Date,
  trendStart: Date,
  trendEnd: Date,
  trendMode: { allTimeChart: boolean },
): Promise<DashboardAnalytics> {
  const [revenueAgg, leadsCount, wonCount, lostCount, expensesAgg] = await Promise.all([
    prisma.invoicePayment.aggregate({
      where: { companyId, date: { gte: kpiStart, lte: kpiEnd } },
      _sum: { amount: true },
    }),
    prisma.lead.count({
      where: { companyId, createdAt: { gte: kpiStart, lte: kpiEnd } },
    }),
    prisma.lead.count({
      where: { companyId, status: LeadStatus.WON, updatedAt: { gte: kpiStart, lte: kpiEnd } },
    }),
    prisma.lead.count({
      where: { companyId, status: LeadStatus.LOST, updatedAt: { gte: kpiStart, lte: kpiEnd } },
    }),
    prisma.expense.aggregate({
      where: { companyId, date: { gte: kpiStart, lte: kpiEnd } },
      _sum: { amount: true },
    }),
  ]);

  const closed = wonCount + lostCount;
  const conversionPercent = closed > 0 ? Math.round((100 * wonCount) / closed) : 0;

  const daily = shouldUseDailyBuckets(trendStart, trendEnd);
  const keys = daily
    ? enumerateDayKeys(trendStart, trendEnd)
    : trendMode.allTimeChart
      ? trailingMonthKeysEndAt(trendEnd, 36)
      : enumerateMonthKeys(trendStart, trendEnd, 120);

  const [payments, leadRows, expenseRows] = await Promise.all([
    prisma.invoicePayment.findMany({
      where: { companyId, date: { gte: trendStart, lte: trendEnd } },
      select: { amount: true, date: true },
    }),
    prisma.lead.findMany({
      where: { companyId, createdAt: { gte: trendStart, lte: trendEnd } },
      select: { createdAt: true },
    }),
    prisma.expense.findMany({
      where: { companyId, date: { gte: trendStart, lte: trendEnd } },
      select: { amount: true, date: true },
    }),
  ]);

  const payBucket = new Map<string, number>();
  const leadBucket = new Map<string, number>();
  const expBucket = new Map<string, number>();
  for (const k of keys) {
    payBucket.set(k, 0);
    leadBucket.set(k, 0);
    expBucket.set(k, 0);
  }

  for (const p of payments) {
    if (p.date < trendStart || p.date > trendEnd) continue;
    const k = daily ? dayKey(p.date) : monthKey(p.date);
    if (!payBucket.has(k)) continue;
    payBucket.set(k, roundMoney((payBucket.get(k) ?? 0) + p.amount));
  }
  for (const l of leadRows) {
    if (l.createdAt < trendStart || l.createdAt > trendEnd) continue;
    const k = daily ? dayKey(l.createdAt) : monthKey(l.createdAt);
    if (!leadBucket.has(k)) continue;
    leadBucket.set(k, (leadBucket.get(k) ?? 0) + 1);
  }
  for (const e of expenseRows) {
    if (e.date < trendStart || e.date > trendEnd) continue;
    const k = daily ? dayKey(e.date) : monthKey(e.date);
    if (!expBucket.has(k)) continue;
    expBucket.set(k, roundMoney((expBucket.get(k) ?? 0) + e.amount));
  }

  const trend: DashboardAnalyticsTrendPoint[] = keys.map((k) => ({
    key: k,
    label: daily ? dayLabelFromKey(k) : monthLabelFromKey(k),
    revenue: roundMoney(payBucket.get(k) ?? 0),
    leads: leadBucket.get(k) ?? 0,
    expenses: roundMoney(expBucket.get(k) ?? 0),
  }));

  return {
    revenue: roundMoney(revenueAgg._sum.amount ?? 0),
    leads: leadsCount,
    conversionPercent,
    expenses: roundMoney(expensesAgg._sum.amount ?? 0),
    trend,
  };
}
