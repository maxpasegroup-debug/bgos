"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { prepareAddBusinessNavigation } from "@/lib/bgos-add-business-intent";
import { useBgosDashboardContext } from "@/components/bgos/BgosDataProvider";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";

type SummaryJson = {
  ok?: boolean;
  metrics?: {
    totalCompanies: number;
    totalLeads: number;
    totalRevenue: number | null;
    activeUsers: number;
  };
};

type CompanyRow = {
  companyId: string;
  name: string;
  internalSalesOrg?: boolean;
  plan?: string;
  createdAt?: string;
};

export default function BgosControlPage() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const { refetch } = useBgosDashboardContext();
  const [summary, setSummary] = useState<SummaryJson["metrics"] | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [sRes, cRes] = await Promise.all([
        fetch("/api/bgos/control/summary", { credentials: "include" }),
        fetch("/api/company/list", { credentials: "include" }),
      ]);
      if (!sRes.ok) {
        setLoadError("Could not load global metrics.");
        return;
      }
      const sj = (await sRes.json()) as SummaryJson;
      if (sj.ok && sj.metrics) setSummary(sj.metrics);

      if (cRes.ok) {
        const cj = (await cRes.json()) as { ok?: boolean; companies?: CompanyRow[] };
        if (cj.ok && Array.isArray(cj.companies)) setCompanies(cj.companies);
      }
    } catch {
      setLoadError("Network error.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDashboard(companyId: string) {
    setOpeningId(companyId);
    try {
      const res = await fetch("/api/company/switch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const j = (await res.json()) as { ok?: boolean; redirectPath?: string };
      if (!res.ok || !j.ok) {
        await load();
        return;
      }
      refetch();
      const path =
        typeof j.redirectPath === "string" && j.redirectPath.startsWith("/")
          ? j.redirectPath
          : "/bgos";
      window.location.assign(path);
    } finally {
      setOpeningId(null);
    }
  }

  const cardShell = light
    ? "rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm"
    : "rounded-2xl border border-white/[0.08] bg-[#121821]/80 p-5 shadow-[0_0_40px_-12px_rgba(0,0,0,0.5)]";

  const labelCls = light ? "text-[11px] font-semibold uppercase tracking-wider text-slate-500" : "text-[11px] font-semibold uppercase tracking-wider text-white/50";
  const valueCls = light ? "mt-1 text-2xl font-semibold tabular-nums text-slate-900" : "mt-1 text-2xl font-semibold tabular-nums text-white";
  const mutedCls = light ? "text-sm text-slate-600" : "text-sm text-white/65";

  return (
    <div className={`mx-auto max-w-6xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <div className="mb-8">
        <h1 className={light ? "text-2xl font-bold tracking-tight text-slate-900" : "text-2xl font-bold tracking-tight text-white"}>
          BGOS Control
        </h1>
        <p className={mutedCls + " mt-1 max-w-2xl"}>
          Global platform overview — all companies, leads, and team activity. Not scoped to a single tenant.
        </p>
      </div>

      {loadError ? (
        <p className="mb-6 text-sm text-amber-600 dark:text-amber-400" role="alert">
          {loadError}
        </p>
      ) : null}

      <section className="mb-10" aria-labelledby="global-metrics">
        <h2 id="global-metrics" className={labelCls + " mb-3"}>
          Global metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={cardShell}>
            <p className={labelCls}>Total companies</p>
            <p className={valueCls}>{summary?.totalCompanies ?? "—"}</p>
          </div>
          <div className={cardShell}>
            <p className={labelCls}>Total leads</p>
            <p className={valueCls}>{summary?.totalLeads ?? "—"}</p>
          </div>
          <div className={cardShell}>
            <p className={labelCls}>Total revenue</p>
            <p className={valueCls}>{summary?.totalRevenue != null ? summary.totalRevenue : "—"}</p>
            <p className={mutedCls + " mt-1 text-xs"}>Future-ready</p>
          </div>
          <div className={cardShell}>
            <p className={labelCls}>Active users</p>
            <p className={valueCls}>{summary?.activeUsers ?? "—"}</p>
          </div>
        </div>
      </section>

      <section className="mb-10" id="companies" aria-labelledby="company-list-heading">
        <h2 id="company-list-heading" className={labelCls + " mb-3"}>
          All companies
        </h2>
        <div className={cardShell + " overflow-hidden p-0"}>
          <ul>
            {companies.length === 0 ? (
              <li className={"px-5 py-8 " + mutedCls}>No companies yet.</li>
            ) : (
              companies.map((c, i) => (
                <li
                  key={c.companyId}
                  className={
                    (light
                      ? "flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                      : "flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between") +
                    (i === companies.length - 1 ? " border-b-0" : "")
                  }
                >
                  <div className="min-w-0">
                    <p className={light ? "font-semibold text-slate-900" : "font-semibold text-white"}>
                      {c.name}
                    </p>
                    <p className={mutedCls + " mt-0.5 text-xs"}>
                      {c.internalSalesOrg ? "Internal sales org" : "Solar / BGOS"} · {c.plan ?? "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={openingId !== null}
                    onClick={() => void openDashboard(c.companyId)}
                    className={
                      light
                        ? "shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-900 transition hover:bg-indigo-100 disabled:opacity-50"
                        : "shrink-0 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:opacity-50"
                    }
                  >
                    {openingId === c.companyId ? "Opening…" : "Open dashboard"}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="mb-10" aria-labelledby="quick-actions">
        <h2 id="quick-actions" className={labelCls + " mb-3"}>
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/onboarding"
            onClick={() => prepareAddBusinessNavigation()}
            className={
              light
                ? "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                : "rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.09]"
            }
          >
            Create new company
          </Link>
          <p className={mutedCls + " flex items-center text-sm"}>
            Use the company switcher in the header to change the active business.
          </p>
        </div>
      </section>

      <section aria-labelledby="internal-sales">
        <h2 id="internal-sales" className={labelCls + " mb-3"}>
          BGOS internal system
        </h2>
        <Link
          href="/iceconnect/internal-sales"
          className={
            light
              ? "inline-flex rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-900 hover:bg-violet-100"
              : "inline-flex rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-500/15"
          }
        >
          View internal sales
        </Link>
      </section>
    </div>
  );
}
