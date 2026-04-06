import type { DashboardFinancialOverview, DashboardMonthlyTrendPoint } from "@/types";

export function buildDefaultFinancialTrend(now = new Date()): DashboardMonthlyTrendPoint[] {
  const out: DashboardMonthlyTrendPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      monthKey,
      label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      amount: 0,
    });
  }
  return out;
}

export function emptyFinancialOverview(now = new Date()): DashboardFinancialOverview {
  return {
    totalRevenue: 0,
    pendingPayments: 0,
    monthlyRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    monthlyRevenueTrend: buildDefaultFinancialTrend(now),
    expenseChangePercent: null,
  };
}

export function normalizeFinancialOverview(raw: unknown): DashboardFinancialOverview {
  const base = emptyFinancialOverview();
  if (!raw || typeof raw !== "object") return base;
  const f = raw as Record<string, unknown>;

  const trendRaw = f.monthlyRevenueTrend;
  let monthlyRevenueTrend = base.monthlyRevenueTrend;
  if (Array.isArray(trendRaw) && trendRaw.length > 0) {
    monthlyRevenueTrend = trendRaw.map((p) => {
      if (!p || typeof p !== "object") {
        return { monthKey: "", label: "", amount: 0 };
      }
      const o = p as Record<string, unknown>;
      return {
        monthKey: typeof o.monthKey === "string" ? o.monthKey : "",
        label: typeof o.label === "string" ? o.label : "",
        amount: typeof o.amount === "number" && Number.isFinite(o.amount) ? o.amount : 0,
      };
    });
  }

  const pct = f.expenseChangePercent;
  return {
    totalRevenue: typeof f.totalRevenue === "number" && Number.isFinite(f.totalRevenue) ? f.totalRevenue : 0,
    pendingPayments:
      typeof f.pendingPayments === "number" && Number.isFinite(f.pendingPayments) ? f.pendingPayments : 0,
    monthlyRevenue:
      typeof f.monthlyRevenue === "number" && Number.isFinite(f.monthlyRevenue) ? f.monthlyRevenue : 0,
    totalExpenses: typeof f.totalExpenses === "number" && Number.isFinite(f.totalExpenses) ? f.totalExpenses : 0,
    netProfit: typeof f.netProfit === "number" && Number.isFinite(f.netProfit) ? f.netProfit : 0,
    monthlyRevenueTrend,
    expenseChangePercent:
      typeof pct === "number" && Number.isFinite(pct) ? pct : null,
  };
}
