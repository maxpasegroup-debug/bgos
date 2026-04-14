"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import { useBgosDashboardContext } from "@/components/bgos/BgosDataProvider";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type ExpenseRow = {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  createdAt: string;
};

type AnalyticsPayload = {
  monthKey: string;
  monthTotal: number;
  byCategory: { category: string; total: number }[];
  categoryTotals: Record<string, number>;
  monthlyBars: { monthKey: string; label: string; total: number }[];
  highThreshold: number;
};

const PIE_COLORS = ["#FFC300", "#f97316", "#3b82f6", "#22c55e", "#a855f7", "#94a3b8"];

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/12 bg-black/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#FFC300]/45";
const btnPrimary =
  "inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[#FFC300]/45 bg-[#FFC300]/18 px-5 text-sm font-bold text-[#FFC300] transition hover:bg-[#FFC300]/24 disabled:opacity-50";

export function BgosExpensesPageClient() {
  const { trialReadOnly } = useBgosDashboardContext();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [filterCategory, setFilterCategory] = useState("");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<typeof EXPENSE_CATEGORIES[number]>("Misc");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; amount?: string }>({});

  const loadList = useCallback(async () => {
    setError(null);
    try {
      const p = new URLSearchParams();
      if (filterMonth) p.set("monthly", filterMonth);
      if (filterCategory.trim()) p.set("category", filterCategory.trim());
      const res = await apiFetch(`/api/expense/list?${p}`);
      const data = (await res.json()) as { ok?: boolean; expenses?: ExpenseRow[]; error?: string };
      if (!res.ok || !data.ok || !Array.isArray(data.expenses)) {
        const msg =
          typeof data.error === "string" && data.error.trim()
            ? `${data.error} (HTTP ${res.status})`
            : `Could not load expenses (HTTP ${res.status})`;
        setError(msg);
        setRows([]);
        return;
      }
      setRows(data.expenses);
    } catch (e) {
      console.error("API ERROR:", e);
      setError(formatFetchFailure(e, "Could not reach expense list API"));
      setRows([]);
    }
  }, [filterMonth, filterCategory]);

  const loadAnalytics = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      p.set("monthly", filterMonth);
      const res = await apiFetch(`/api/expense/analytics?${p}`);
      const data = (await res.json()) as { ok?: boolean } & Partial<AnalyticsPayload>;
      if (!res.ok || !data.ok) {
        setAnalytics(null);
        return;
      }
      setAnalytics({
        monthKey: data.monthKey ?? filterMonth,
        monthTotal: data.monthTotal ?? 0,
        byCategory: Array.isArray(data.byCategory) ? data.byCategory : [],
        categoryTotals:
          data.categoryTotals && typeof data.categoryTotals === "object"
            ? data.categoryTotals
            : {},
        monthlyBars: Array.isArray(data.monthlyBars) ? data.monthlyBars : [],
        highThreshold: typeof data.highThreshold === "number" ? data.highThreshold : 0,
      });
    } catch (e) {
      console.error("API ERROR:", e);
      setAnalytics(null);
    }
  }, [filterMonth]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadList(), loadAnalytics()]);
    setLoading(false);
  }, [loadList, loadAnalytics]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pieData = useMemo(
    () =>
      (analytics?.byCategory ?? [])
        .filter((x) => x.total > 1e-9)
        .map((x) => ({ name: x.category, value: x.total })),
    [analytics],
  );

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (trialReadOnly) {
      setError("Your free trial has expired. Upgrade to add expenses.");
      return;
    }
    setFieldErrors({});
    const errs: typeof fieldErrors = {};
    if (!title.trim()) errs.title = "Title is required";
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) errs.amount = "Enter a positive amount";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/expense/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          amount: n,
          category,
          date: new Date(date + "T12:00:00").toISOString(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !data.ok) {
        setError(
          data.code === "TRIAL_EXPIRED"
            ? typeof data.error === "string" && data.error.trim()
              ? data.error
              : "Your free trial has expired. Upgrade to continue."
            : typeof data.error === "string"
              ? data.error
              : "Could not save expense",
        );
        return;
      }
      setTitle("");
      setAmount("");
      await refresh();
    } catch (e) {
      console.error("API ERROR:", e);
      setError(formatFetchFailure(e, "Could not reach expense create API"));
    } finally {
      setBusy(false);
    }
  }

  const highThreshold = analytics?.highThreshold ?? 0;

  return (
    <div className={`mx-auto max-w-6xl px-4 sm:px-6 ${BGOS_MAIN_PAD}`}>
      <Link href="/bgos/money" className="text-xs font-medium text-white/50 transition hover:text-[#FFC300]">
        ← Money
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">Expenses</h1>
      <p className="mt-1 text-sm text-white/55">
        Track spending by category, filter by month, and see trends — company scoped.
      </p>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-500/35 bg-red-950/30 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardSurface tilt={false} className="p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">This month</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-[#FFC300] sm:text-2xl">
            {loading ? "—" : formatInr(analytics?.monthTotal ?? 0)}
          </p>
          <p className="mt-1 text-[10px] text-white/35">{filterMonth} · filtered view</p>
        </DashboardSurface>
        {EXPENSE_CATEGORIES.map((cat) => (
          <DashboardSurface key={cat} tilt={false} className="p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{cat}</p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-white">
              {loading ? "—" : formatInr(analytics?.categoryTotals[cat] ?? 0)}
            </p>
          </DashboardSurface>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <DashboardSurface tilt={false} className="p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Category mix</h2>
          <p className="mt-0.5 text-xs text-white/40">Share of spend in {filterMonth}</p>
          <div className="mt-4 h-[280px] w-full min-h-[240px]">
            {pieData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-white/40">No data this month</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="rgba(15,23,42,0.5)" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatInr(typeof v === "number" ? v : Number(v) || 0)}
                    contentStyle={{
                      background: "rgba(15,23,42,0.95)",
                      border: "1px solid rgba(255,195,0,0.25)",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </DashboardSurface>

        <DashboardSurface tilt={false} className="p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Monthly spend</h2>
          <p className="mt-0.5 text-xs text-white/40">Last 6 calendar months</p>
          <div className="mt-4 h-[280px] w-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.monthlyBars ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} axisLine={false} />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v}`)}
                />
                <Tooltip
                  formatter={(v) => formatInr(typeof v === "number" ? v : Number(v) || 0)}
                  contentStyle={{
                    background: "rgba(15,23,42,0.95)",
                    border: "1px solid rgba(255,195,0,0.25)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="url(#expBar)" />
                <defs>
                  <linearGradient id="expBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFC300" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardSurface>
      </div>

      <DashboardSurface tilt={false} className="mt-8 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-white">Add expense</h2>
        <p className="mt-1 text-xs text-white/45">Positive amounts only. Updates lists and charts immediately.</p>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(e) => void addExpense(e)}>
          <label className="sm:col-span-2">
            <span className="text-[11px] font-medium text-white/50">Title</span>
            <input
              className={inputClass}
              disabled={trialReadOnly}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              aria-invalid={Boolean(fieldErrors.title)}
            />
            {fieldErrors.title ? <p className="mt-1 text-xs text-red-300">{fieldErrors.title}</p> : null}
          </label>
          <label>
            <span className="text-[11px] font-medium text-white/50">Amount (₹)</span>
            <input
              type="number"
              min={0.01}
              step="0.01"
              className={inputClass}
              disabled={trialReadOnly}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              aria-invalid={Boolean(fieldErrors.amount)}
            />
            {fieldErrors.amount ? <p className="mt-1 text-xs text-red-300">{fieldErrors.amount}</p> : null}
          </label>
          <label>
            <span className="text-[11px] font-medium text-white/50">Category</span>
            <select
              className={`${inputClass} cursor-pointer`}
              disabled={trialReadOnly}
              value={category}
              onChange={(e) => setCategory(e.target.value as (typeof EXPENSE_CATEGORIES)[number])}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="text-[11px] font-medium text-white/50">Date</span>
            <input
              type="date"
              className={inputClass}
              disabled={trialReadOnly}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <button type="submit" className={`${btnPrimary} sm:col-span-2`} disabled={busy || trialReadOnly}>
            {busy ? "Saving…" : "Add expense"}
          </button>
        </form>
      </DashboardSurface>

      <DashboardSurface tilt={false} className="mt-8 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Filters</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="text-xs text-white/55">
            Month
            <input
              type="month"
              className={inputClass}
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </label>
          <label className="text-xs text-white/55">
            Category
            <select
              className={`${inputClass} min-w-[10rem] cursor-pointer`}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      </DashboardSurface>

      <div className="mt-8 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">Expense log</h3>
        {highThreshold > 0 ? (
          <p className="text-[11px] text-white/40">
            Rows with a <span className="text-red-300/90">warm border</span> are relatively large for this month
            (≈ top quartile or ≥12% of monthly total).
          </p>
        ) : null}
        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-white/[0.06]" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-white/40">No expenses in this view.</p>
        ) : (
          rows.map((ex, idx) => {
            const isHigh = highThreshold > 0 && ex.amount >= highThreshold;
            return (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.2) }}
              >
                <DashboardSurface
                  tilt={false}
                  className={`p-4 transition ${
                    isHigh
                      ? "border-red-500/40 bg-red-950/20 ring-1 ring-red-500/20"
                      : "border-white/[0.08] bg-white/[0.03]"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{ex.title}</p>
                      <p className="text-xs text-white/45">
                        {ex.category} · {new Date(ex.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                      </p>
                    </div>
                    <p
                      className={`tabular-nums text-sm font-semibold ${
                        isHigh ? "text-red-200" : "text-white"
                      }`}
                    >
                      {formatInr(ex.amount)}
                    </p>
                  </div>
                </DashboardSurface>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
