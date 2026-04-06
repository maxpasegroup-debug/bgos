"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import type { DashboardFinancialOverview } from "@/types";
import { fadeUp } from "./motion";
import { BGOS_GRID_GAP } from "./layoutTokens";

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function BgosFinancialOverview({ financial }: { financial: DashboardFinancialOverview }) {
  const maxTrend = Math.max(1, ...financial.monthlyRevenueTrend.map((t) => t.amount));

  const showPendingAlert = financial.pendingPayments > 1e-9;
  const expPct = financial.expenseChangePercent;
  const showExpenseUpAlert = expPct != null && expPct > 0.5;

  return (
    <motion.section
      id="finance"
      variants={fadeUp}
      className="col-span-full space-y-4"
      style={{ scrollMarginTop: "5.5rem" }}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white sm:text-base">Financial overview</h2>
          <p className="mt-0.5 text-xs text-white/45">
            Invoice collections, receivables, and expenses — updates with your dashboard refresh.
          </p>
        </div>
        <Link
          href="/bgos/money"
          className="mt-2 text-xs font-medium text-[#FFC300] transition hover:text-[#FFE066] sm:mt-0"
        >
          Open money →
        </Link>
      </div>

      {(showPendingAlert || showExpenseUpAlert) && (
        <div className="flex flex-col gap-2">
          {showPendingAlert ? (
            <div
              className="rounded-xl border border-red-500/40 bg-red-950/35 px-4 py-3 text-sm text-red-100"
              role="status"
            >
              <span className="font-semibold text-red-200">Outstanding receivables: </span>
              {formatInr(financial.pendingPayments)} pending from customers
            </div>
          ) : null}
          {showExpenseUpAlert ? (
            <div
              className="rounded-xl border border-amber-500/35 bg-amber-950/30 px-4 py-3 text-sm text-amber-100"
              role="status"
            >
              <span className="font-semibold text-amber-200/95">Spend alert: </span>
              Expenses this month are up{" "}
              <span className="tabular-nums font-semibold">{expPct!.toFixed(0)}%</span>{" "}
              vs last month
            </div>
          ) : null}
        </div>
      )}

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 ${BGOS_GRID_GAP}`}>
        <DashboardSurface className="p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
            Total revenue
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-white sm:text-2xl">
            {formatInr(financial.totalRevenue)}
          </p>
          <p className="mt-1 text-[10px] text-white/35">Collected on invoices (all time)</p>
        </DashboardSurface>

        <DashboardSurface className="border-red-500/25 !bg-red-500/[0.06] p-4 sm:p-5 ring-1 ring-red-500/15">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-200/80">
            Pending payments
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-red-100 sm:text-2xl">
            {formatInr(financial.pendingPayments)}
          </p>
          <p className="mt-1 text-[10px] text-red-200/50">Unpaid invoice balance</p>
        </DashboardSurface>

        <DashboardSurface className="p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
            Monthly revenue
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-white sm:text-2xl">
            {formatInr(financial.monthlyRevenue)}
          </p>
          <p className="mt-1 text-[10px] text-white/35">Payments received this month</p>
        </DashboardSurface>

        <DashboardSurface className="p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Expenses</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-white sm:text-2xl">
            {formatInr(financial.totalExpenses)}
          </p>
          <p className="mt-1 text-[10px] text-white/35">Recorded expenses (all time)</p>
        </DashboardSurface>

        <DashboardSurface className="border-emerald-500/30 !bg-emerald-950/25 p-4 sm:p-5 ring-1 ring-emerald-500/15">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/85">
            Net profit
          </p>
          <p
            className={`mt-2 text-xl font-semibold tabular-nums sm:text-2xl ${
              financial.netProfit >= 0 ? "text-emerald-200" : "text-red-200"
            }`}
          >
            {formatInr(financial.netProfit)}
          </p>
          <p className="mt-1 text-[10px] text-emerald-200/55">Total revenue − total expenses</p>
        </DashboardSurface>
      </div>

      <DashboardSurface tilt={false} className="p-4 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Monthly revenue trend
        </p>
        <p className="mt-0.5 text-[10px] text-white/35">Cash inflow from invoice payments by month</p>
        <div className="mt-6 flex h-36 items-end gap-2 sm:gap-3">
          {financial.monthlyRevenueTrend.map((pt) => {
            const h = Math.round((pt.amount / maxTrend) * 100);
            return (
              <div key={pt.monthKey} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end justify-center">
                  <div
                    className="w-full max-w-[3rem] rounded-t-md bg-gradient-to-t from-[#FF3B3B]/70 to-[#FFC300]/80"
                    style={{ height: `${Math.max(8, h)}%` }}
                    title={`${pt.label}: ${formatInr(pt.amount)}`}
                  />
                </div>
                <span className="truncate text-center text-[9px] font-medium text-white/50 sm:text-[10px]">
                  {pt.label}
                </span>
              </div>
            );
          })}
        </div>
      </DashboardSurface>
    </motion.section>
  );
}
