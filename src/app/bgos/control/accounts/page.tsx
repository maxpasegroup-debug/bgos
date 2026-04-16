"use client";

import { useCallback, useEffect, useState } from "react";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";

type AccountsJson = {
  ok?: boolean;
  totalRevenueInr?: number;
  mrr?: number;
  pendingPayments?: number;
  activePlans?: { trialCompanies: number; paidCompanies: number };
  renewalsUpcoming30d?: number;
  companyBilling?: { companyId: string; name: string; totalInr: number; payments: number }[];
  recentPayments?: {
    companyName: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
  }[];
  planBreakdown?: Record<string, number>;
  industryBreakdown?: Record<string, number>;
};

export default function ControlAccountsPage() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const [data, setData] = useState<AccountsJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/bgos/control/accounts-overview", { credentials: "include" });
      const j = ((await readApiJson(res, "control/accounts")) ?? {}) as AccountsJson & {
        error?: string;
        code?: string;
      };
      if (!res.ok || !j.ok) {
        const hint =
          typeof j.error === "string" && j.error.trim()
            ? `${j.error} (HTTP ${res.status})`
            : j.code === "FORBIDDEN"
              ? "Sign in with the platform boss account (BGOS_BOSS_EMAIL)."
              : `Could not load accounts. (HTTP ${res.status})`;
        setError(hint);
        return;
      }
      setData(j);
    } catch (e) {
      console.error("API ERROR:", e);
      setError(formatFetchFailure(e, "Could not reach accounts API"));
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const cardShell = light
    ? "rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm"
    : "rounded-2xl border border-white/[0.08] bg-[#121821]/80 p-5";
  const muted = light ? "text-sm text-slate-600" : "text-sm text-white/65";
  const h1 = light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white";

  const rev = data?.totalRevenueInr != null ? (data.totalRevenueInr / 100).toFixed(2) : "—";
  const mrr = data?.mrr != null ? (data.mrr / 100).toFixed(2) : "—";
  const pending = data?.pendingPayments != null ? (data.pendingPayments / 100).toFixed(2) : "—";

  return (
    <div className={`mx-auto max-w-6xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <h1 className={h1}>Accounts</h1>
      <p className={muted + " mt-1"}>Revenue from recorded Razorpay payments (customer companies).</p>
      {error ? <p className="mt-4 text-sm text-amber-500">{error}</p> : null}

      {data ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className={cardShell}>
              <p className={muted}>Total revenue (INR)</p>
              <p className={h1 + " mt-1 text-xl"}>₹{rev}</p>
            </div>
            <div className={cardShell}>
              <p className={muted}>MRR (this month)</p>
              <p className={h1 + " mt-1 text-xl"}>₹{mrr}</p>
            </div>
            <div className={cardShell}>
              <p className={muted}>Pending payments</p>
              <p className={h1 + " mt-1 text-xl"}>₹{pending}</p>
            </div>
            <div className={cardShell}>
              <p className={muted}>Active plans</p>
              <p className={h1 + " mt-2 text-sm"}>
                Trial companies: {data.activePlans?.trialCompanies ?? 0}
              </p>
              <p className={h1 + " mt-1 text-sm"}>Paid companies: {data.activePlans?.paidCompanies ?? 0}</p>
            </div>
            <div className={cardShell}>
              <p className={muted}>Renewals (next 30 days)</p>
              <p className={h1 + " mt-1 text-xl"}>{data.renewalsUpcoming30d ?? 0}</p>
            </div>
          </div>
          <div className={cardShell}>
            <p className={light ? "font-bold text-slate-900" : "font-bold text-white"}>Company-wise billing</p>
            <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto text-sm">
              {(data.companyBilling ?? []).map((c) => (
                <li key={c.companyId} className={muted}>
                  {c.name} — ₹{(c.totalInr / 100).toFixed(2)} ({c.payments} payments)
                </li>
              ))}
            </ul>
          </div>
          <div className={`lg:col-span-2 ${cardShell}`}>
            <p className={light ? "font-bold text-slate-900" : "font-bold text-white"}>Plan-wise / Industry-wise breakdown</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className={muted + " text-xs"}>By plan</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {Object.entries(data.planBreakdown ?? {}).map(([k, v]) => (
                    <li key={k} className={muted}>
                      {k}: ₹{(v / 100).toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={muted + " text-xs"}>By industry</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {Object.entries(data.industryBreakdown ?? {}).map(([k, v]) => (
                    <li key={k} className={muted}>
                      {k}: ₹{(v / 100).toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className={`lg:col-span-2 ${cardShell}`}>
            <p className={light ? "font-bold text-slate-900" : "font-bold text-white"}>Recent payments</p>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {(data.recentPayments ?? []).map((p, i) => (
                <li key={i} className={muted}>
                  {p.companyName} · ₹{(p.amount / 100).toFixed(2)} · {p.status} ·{" "}
                  {new Date(p.createdAt).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : !error ? (
        <p className={muted + " mt-6"}>Loading…</p>
      ) : null}
    </div>
  );
}
