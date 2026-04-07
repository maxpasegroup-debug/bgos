import "server-only";

import { prisma } from "./prisma";
import { roundMoney } from "./money-items";

export type MonthlyTrendPoint = {
  monthKey: string;
  /** Short label e.g. "Apr '26" */
  label: string;
  amount: number;
};

export type RevenueMetrics = {
  /** Sum of collected invoice payments (all `Invoice.paidAmount`). */
  totalRevenue: number;
  /** Outstanding balance on invoices. */
  pendingPayments: number;
  /** Invoices with a positive balance (excludes fully paid). */
  unpaidInvoiceCount: number;
  /** Sum of `InvoicePayment` rows dated in the current calendar month. */
  monthlyRevenue: number;
  /** Last N calendar months of payment inflow (including zeros). */
  monthlyRevenueTrend: MonthlyTrendPoint[];
};

export type ExpenseMetrics = {
  totalExpenses: number;
  currentMonthTotal: number;
  previousMonthTotal: number;
  /** `(current - previous) / previous * 100` when previous > 0; else `null`. */
  expenseChangePercent: number | null;
};

export type FinancialOverview = RevenueMetrics &
  ExpenseMetrics & {
    netProfit: number;
    /** Alias for {@link ExpenseMetrics.currentMonthTotal} (dashboards). */
    currentMonthExpenses: number;
    monthlyExpenseTrend: MonthlyTrendPoint[];
  };

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

/** First day of month, shifted by delta months. */
function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

/**
 * Invoice-side revenue: collected totals, receivables, and payment inflow by month.
 */
export async function calculateRevenue(
  companyId: string,
  trendMonthCount = 6,
): Promise<RevenueMetrics> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const trendStart = startOfMonth(addMonths(now, -(trendMonthCount - 1)));

  const [paidAgg, invoices, monthPaymentsAgg, trendPayments] = await Promise.all([
    prisma.invoice.aggregate({
      where: { companyId },
      _sum: { paidAmount: true },
    }),
    prisma.invoice.findMany({
      where: { companyId },
      select: { totalAmount: true, paidAmount: true },
    }),
    prisma.invoicePayment.aggregate({
      where: {
        companyId,
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    }),
    prisma.invoicePayment.findMany({
      where: { companyId, date: { gte: trendStart } },
      select: { amount: true, date: true },
    }),
  ]);

  let pendingPayments = 0;
  let unpaidInvoiceCount = 0;
  for (const inv of invoices) {
    const due = roundMoney(inv.totalAmount - inv.paidAmount);
    if (due > 1e-9) {
      pendingPayments = roundMoney(pendingPayments + due);
      unpaidInvoiceCount += 1;
    }
  }

  const keys: string[] = [];
  for (let i = 0; i < trendMonthCount; i++) {
    keys.push(monthKey(startOfMonth(addMonths(now, -(trendMonthCount - 1 - i)))));
  }

  const bucket = new Map<string, number>();
  for (const k of keys) bucket.set(k, 0);
  for (const p of trendPayments) {
    const k = monthKey(p.date);
    if (!bucket.has(k)) continue;
    bucket.set(k, roundMoney((bucket.get(k) ?? 0) + p.amount));
  }

  const monthlyRevenueTrend: MonthlyTrendPoint[] = keys.map((k) => ({
    monthKey: k,
    label: monthLabel(k),
    amount: roundMoney(bucket.get(k) ?? 0),
  }));

  return {
    totalRevenue: roundMoney(paidAgg._sum.paidAmount ?? 0),
    pendingPayments,
    unpaidInvoiceCount,
    monthlyRevenue: roundMoney(monthPaymentsAgg._sum.amount ?? 0),
    monthlyRevenueTrend,
  };
}

/**
 * Expense totals and month-over-month change.
 */
export async function calculateExpenses(companyId: string): Promise<ExpenseMetrics> {
  const now = new Date();
  const curStart = startOfMonth(now);
  const curEnd = endOfMonth(now);
  const prevRef = addMonths(now, -1);
  const prevStart = startOfMonth(prevRef);
  const prevEnd = endOfMonth(prevRef);

  const [totalAgg, curAgg, prevAgg] = await Promise.all([
    prisma.expense.aggregate({
      where: { companyId },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { companyId, date: { gte: curStart, lte: curEnd } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { companyId, date: { gte: prevStart, lte: prevEnd } },
      _sum: { amount: true },
    }),
  ]);

  const totalExpenses = roundMoney(totalAgg._sum.amount ?? 0);
  const currentMonthTotal = roundMoney(curAgg._sum.amount ?? 0);
  const previousMonthTotal = roundMoney(prevAgg._sum.amount ?? 0);

  let expenseChangePercent: number | null = null;
  if (previousMonthTotal > 1e-9) {
    expenseChangePercent = roundMoney(
      (100 * (currentMonthTotal - previousMonthTotal)) / previousMonthTotal,
    );
  }

  return {
    totalExpenses,
    currentMonthTotal,
    previousMonthTotal,
    expenseChangePercent,
  };
}

/**
 * Last N calendar months of expense totals (including zero months).
 */
export async function calculateExpenseMonthlyTrend(
  companyId: string,
  trendMonthCount = 6,
): Promise<MonthlyTrendPoint[]> {
  const now = new Date();
  const trendStart = startOfMonth(addMonths(now, -(trendMonthCount - 1)));
  const trendEnd = endOfMonth(now);

  const rows = await prisma.expense.findMany({
    where: { companyId, date: { gte: trendStart, lte: trendEnd } },
    select: { amount: true, date: true },
  });

  const keys: string[] = [];
  for (let i = 0; i < trendMonthCount; i++) {
    keys.push(monthKey(startOfMonth(addMonths(now, -(trendMonthCount - 1 - i)))));
  }
  const bucket = new Map<string, number>();
  for (const k of keys) bucket.set(k, 0);
  for (const r of rows) {
    const k = monthKey(r.date);
    if (!bucket.has(k)) continue;
    bucket.set(k, roundMoney((bucket.get(k) ?? 0) + r.amount));
  }

  return keys.map((k) => ({
    monthKey: k,
    label: monthLabel(k),
    amount: roundMoney(bucket.get(k) ?? 0),
  }));
}

/** Full boss snapshot: revenue + expenses + net profit (all-time). */
export async function getFinancialOverview(companyId: string): Promise<FinancialOverview> {
  const [rev, exp, monthlyExpenseTrend] = await Promise.all([
    calculateRevenue(companyId),
    calculateExpenses(companyId),
    calculateExpenseMonthlyTrend(companyId),
  ]);
  const netProfit = roundMoney(rev.totalRevenue - exp.totalExpenses);
  return {
    ...rev,
    ...exp,
    currentMonthExpenses: exp.currentMonthTotal,
    monthlyExpenseTrend,
    netProfit,
  };
}
