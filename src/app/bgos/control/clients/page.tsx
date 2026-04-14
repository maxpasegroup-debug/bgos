"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { formatFetchFailure, apiFetch } from "@/lib/api-fetch";

type Category = "TRIAL" | "BASIC" | "PRO" | "ENTERPRISE" | "LOST";

type CompanyRow = {
  companyId: string;
  name: string;
  category: Category;
  plan: string;
  subscriptionStatus: string;
  bossName: string;
};

const TABS: { key: Category | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "TRIAL", label: "Trial" },
  { key: "BASIC", label: "Basic" },
  { key: "PRO", label: "Pro" },
  { key: "ENTERPRISE", label: "Enterprise" },
  { key: "LOST", label: "Lost" },
];

export default function ControlClientsPage() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const [tab, setTab] = useState<Category | "ALL">("ALL");
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [summary, setSummary] = useState<{
    totalCompanies: number;
    totalLeads: number;
    activeUsers: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cRes, sRes] = await Promise.all([
        apiFetch("/api/bgos/control/clients", { credentials: "include" }),
        apiFetch("/api/bgos/control/summary", { credentials: "include" }),
      ]);
      const cj = (await cRes.json()) as {
        ok?: boolean;
        companies?: CompanyRow[];
        error?: string;
        code?: string;
        details?: string;
      };
      if (!cRes.ok) {
        const hint =
          typeof cj.error === "string" && cj.error.trim()
            ? cj.error
            : cj.code === "FORBIDDEN"
              ? "Sign in with the platform boss account (BGOS_BOSS_EMAIL)."
              : cj.code === "MISCONFIGURED"
                ? "Server: set BGOS_BOSS_EMAIL in environment."
                : "Could not load clients.";
        setError(hint);
        return;
      }
      if (cj.ok && Array.isArray(cj.companies)) setCompanies(cj.companies);

      if (sRes.ok) {
        const sj = (await sRes.json()) as {
          ok?: boolean;
          metrics?: { totalCompanies: number; totalLeads: number; activeUsers: number };
          error?: string;
          code?: string;
        };
        if (sj.ok && sj.metrics) setSummary(sj.metrics);
      }
    } catch (e) {
      console.error("API ERROR:", e);
      setError(formatFetchFailure(e, "Could not reach clients API"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tab === "ALL") return companies;
    return companies.filter((c) => c.category === tab);
  }, [companies, tab]);

  const cardShell = light
    ? "rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm"
    : "rounded-2xl border border-white/[0.08] bg-[#121821]/80 p-5 shadow-[0_0_40px_-12px_rgba(0,0,0,0.5)]";
  const labelCls = light
    ? "text-[11px] font-semibold uppercase tracking-wider text-slate-500"
    : "text-[11px] font-semibold uppercase tracking-wider text-white/50";
  const mutedCls = light ? "text-sm text-slate-600" : "text-sm text-white/65";

  return (
    <div className={`mx-auto max-w-6xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className={light ? "text-2xl font-bold tracking-tight text-slate-900" : "text-2xl font-bold tracking-tight text-white"}>
            Clients
          </h1>
          <p className={mutedCls + " mt-1 max-w-2xl"}>
            Customer companies by lifecycle. Open a card for billing, sales owner, and activity.
          </p>
        </div>
        <Link
          href="/onboarding?addBusiness=1"
          className={
            light
              ? "shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-center text-sm font-semibold text-indigo-900 hover:bg-indigo-100"
              : "shrink-0 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-center text-sm font-semibold text-cyan-100 hover:bg-cyan-500/15"
          }
        >
          Create new company
        </Link>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-amber-600 dark:text-amber-400" role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <section className="mb-8 grid gap-3 sm:grid-cols-3">
          {[
            { k: "Companies", v: summary.totalCompanies },
            { k: "Leads (all tenants)", v: summary.totalLeads },
            { k: "Active users", v: summary.activeUsers },
          ].map((m) => (
            <div key={m.k} className={cardShell}>
              <p className={labelCls}>{m.k}</p>
              <p className={light ? "mt-1 text-xl font-semibold text-slate-900" : "mt-1 text-xl font-semibold text-white"}>
                {m.v}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? light
                  ? "rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full bg-cyan-500/90 px-3 py-1.5 text-xs font-semibold text-slate-950"
                : light
                  ? "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  : "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <p className={mutedCls}>No companies in this category.</p>
        ) : (
          filtered.map((c) => (
            <Link
              key={c.companyId}
              href={`/bgos/control/clients/${c.companyId}`}
              className={cardShell + " block transition hover:opacity-95"}
            >
              <p className={light ? "text-lg font-bold text-slate-900" : "text-lg font-bold text-white"}>{c.name}</p>
              <p className={mutedCls + " mt-2 text-xs"}>by {c.bossName}</p>
              <p className={labelCls + " mt-3"}>
                {c.category} · {c.plan}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
