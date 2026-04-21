"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { apiFetch } from "@/lib/api-fetch";

type TabKey = "company" | "sales" | "franchise" | "rewards" | "payout";

export function PerformanceEngineControlClient() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const [tab, setTab] = useState<TabKey>("company");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/bgos/control/performance-engine", { credentials: "include" });
      const j = (await res.json()) as any;
      if (!res.ok || !j.ok) {
        setError(j.error || "Could not load performance engine.");
        return;
      }
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load performance engine.");
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const card = light
    ? "rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
    : "rounded-2xl border border-white/10 bg-[#0f141c] p-4 text-slate-100";
  const muted = light ? "text-slate-600" : "text-slate-400";
  const tabs = useMemo(
    () =>
      [
        ["company", "Company Targets"],
        ["sales", "Sales Team"],
        ["franchise", "Micro Franchise"],
        ["rewards", "Rewards & Campaigns"],
        ["payout", "Payout Analytics"],
      ] as const,
    [],
  );

  return (
    <div className={BGOS_MAIN_PAD}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className={light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white"}>
            Performance Engine
          </h1>
          <p className={`mt-1 text-sm ${muted}`}>
            Unified control for salaries, targets, commissions, incentives, campaigns, and payouts.
          </p>
        </header>

        {error ? <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</div> : null}

        <div className="flex flex-wrap gap-2">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={
                tab === k
                  ? "rounded-full bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-black"
                  : light
                    ? "rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    : "rounded-full px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
              }
              onClick={() => setTab(k as TabKey)}
            >
              {label}
            </button>
          ))}
        </div>

        {data?.nexa?.length ? (
          <div className={card}>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Nexa Suggestions</p>
            <ul className="mt-2 space-y-1 text-sm">
              {data.nexa.map((n: string) => (
                <li key={n} className={muted}>
                  {n}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tab === "company" ? (
          <div className="grid gap-3 md:grid-cols-2">
            {(data?.tabs?.companyTargets ?? []).map((c: any) => (
              <div key={c.companyId} className={card}>
                <p className="font-semibold">{c.companyName}</p>
                <p className={`mt-1 text-xs ${muted}`}>
                  Monthly: ₹{Math.round(c.monthlyTargetRevenue).toLocaleString("en-IN")} · Weekly: ₹{Math.round(c.weeklyTargetRevenue).toLocaleString("en-IN")} · Daily: ₹{Math.round(c.dailyTargetRevenue).toLocaleString("en-IN")}
                </p>
                <p className={`mt-1 text-xs ${muted}`}>
                  Achieved: ₹{Math.round(c.achievedRevenue).toLocaleString("en-IN")} · Gap: ₹{Math.round(c.gapRemaining).toLocaleString("en-IN")}
                </p>
                <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${c.progressPercent}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "sales" ? (
          <div className="grid gap-3 md:grid-cols-2">
            {(data?.tabs?.salesTeam ?? []).map((s: any) => (
              <div key={s.userId} className={card}>
                <p className="font-semibold">{s.name}</p>
                <p className={`text-xs ${muted}`}>{s.email}</p>
                <p className={`mt-2 text-xs ${muted}`}>
                  Base Salary: ₹{s.baseSalary.toLocaleString("en-IN")} · Target: {s.monthlyTarget} · Commission: {s.commissionPercent}%
                </p>
                <p className={`text-xs ${muted}`}>{s.bonusRule}</p>
                <p className={`mt-2 text-xs ${muted}`}>
                  Leads: {s.leadsHandled} · Conversions: {s.conversions} · Revenue: ₹{Math.round(s.revenueGenerated).toLocaleString("en-IN")}
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-300">
                  Expected Payout: ₹{Math.round(s.expectedPayout).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "franchise" ? (
          <div className="grid gap-3 md:grid-cols-2">
            {(data?.tabs?.microFranchise ?? []).map((f: any) => (
              <div key={f.id} className={card}>
                <p className="font-semibold">{f.name}</p>
                <p className={`text-xs ${muted}`}>Owner: {f.ownerName} · Tier: {f.tier} · Commission: {f.commissionPercent}%</p>
                <p className={`mt-2 text-xs ${muted}`}>
                  Sales: {f.totalSales} · Revenue: ₹{Math.round(f.revenueGenerated).toLocaleString("en-IN")}
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-300">
                  Earned: ₹{Math.round(f.commissionEarned).toLocaleString("en-IN")} · Pending: ₹{Math.round(f.pendingPayouts).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "rewards" ? (
          <div className="space-y-3">
            {(data?.tabs?.rewardsCampaigns?.campaigns ?? []).map((c: any) => (
              <div key={c.id} className={card}>
                <p className="font-semibold">{c.name}</p>
                <p className={`text-xs ${muted}`}>
                  {c.duration} · {c.condition}
                </p>
                <p className={`mt-1 text-xs ${muted}`}>Remaining target: {c.remainingTarget}</p>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "payout" ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className={card}>
              <p className={`text-xs ${muted}`}>Total payouts (monthly)</p>
              <p className="mt-1 text-2xl font-bold">₹{Math.round(data?.tabs?.payoutAnalytics?.totalPayoutsMonthly ?? 0).toLocaleString("en-IN")}</p>
            </div>
            <div className={card}>
              <p className={`text-xs ${muted}`}>Sales vs payout ratio</p>
              <p className="mt-1 text-2xl font-bold">{data?.tabs?.payoutAnalytics?.salesVsPayoutRatio ?? 0}x</p>
            </div>
            <div className={card}>
              <p className={`text-xs ${muted}`}>Top earners</p>
              <ul className="mt-2 space-y-1 text-sm">
                {(data?.tabs?.payoutAnalytics?.topEarners ?? []).map((e: any) => (
                  <li key={e.id} className={muted}>
                    {e.name} — ₹{Math.round(e.payout).toLocaleString("en-IN")}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
