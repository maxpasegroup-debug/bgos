"use client";

import { useCallback, useEffect, useState } from "react";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { formatFetchFailure, apiFetch } from "@/lib/api-fetch";

type SalesJson = {
  ok?: boolean;
  totalLeads?: number;
  wonLeads?: number;
  conversionRate?: number;
  funnel?: { leads: number; demo: number; onboarding: number; live: number };
  perEmployee?: { userId: string | null; name: string; email: string | null; leadCount: number }[];
};

export default function ControlSalesPage() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const [data, setData] = useState<SalesJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/bgos/control/sales-overview", { credentials: "include" });
      const j = (await res.json()) as SalesJson & { error?: string; code?: string };
      if (!res.ok || !j.ok) {
        const hint =
          typeof j.error === "string" && j.error.trim()
            ? `${j.error} (HTTP ${res.status})`
            : j.code === "FORBIDDEN"
              ? "Sign in with the platform boss account (BGOS_BOSS_EMAIL)."
              : `Could not load sales data. (HTTP ${res.status})`;
        setError(hint);
        return;
      }
      setData(j);
    } catch (e) {
      console.error("API ERROR:", e);
      setError(formatFetchFailure(e, "Could not reach sales API"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cardShell = light
    ? "rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm"
    : "rounded-2xl border border-white/[0.08] bg-[#121821]/80 p-5";
  const muted = light ? "text-sm text-slate-600" : "text-sm text-white/65";
  const h1 = light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white";

  const f = data?.funnel;

  return (
    <div className={`mx-auto max-w-6xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <h1 className={h1}>Sales</h1>
      <p className={muted + " mt-1"}>Solar CRM scope (excludes internal sales org).</p>
      {error ? <p className="mt-4 text-sm text-amber-500">{error}</p> : null}

      {data ? (
        <div className="mt-8 space-y-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={cardShell}>
              <p className={muted}>Total leads</p>
              <p className={h1 + " mt-1 text-xl"}>{data.totalLeads}</p>
            </div>
            <div className={cardShell}>
              <p className={muted}>Conversion rate</p>
              <p className={h1 + " mt-1 text-xl"}>{data.conversionRate}%</p>
            </div>
            <div className={cardShell}>
              <p className={muted}>Won / booked</p>
              <p className={h1 + " mt-1 text-xl"}>{data.wonLeads}</p>
            </div>
          </div>

          <div className={cardShell}>
            <p className={light ? "font-bold text-slate-900" : "font-bold text-white"}>Funnel</p>
            <p className={muted + " mt-1 text-xs"}>Leads → Demo → Onboarding → Live</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {[
                { label: "Leads", v: f?.leads ?? 0 },
                { label: "Demo", v: f?.demo ?? 0 },
                { label: "Onboarding", v: f?.onboarding ?? 0 },
                { label: "Live", v: f?.live ?? 0 },
              ].map((x) => (
                <div
                  key={x.label}
                  className={
                    light
                      ? "rounded-xl border border-slate-200 p-3 text-center"
                      : "rounded-xl border border-white/10 p-3 text-center"
                  }
                >
                  <p className="text-2xl font-bold text-inherit">{x.v}</p>
                  <p className={muted + " text-xs"}>{x.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={cardShell}>
            <p className={light ? "font-bold text-slate-900" : "font-bold text-white"}>Per employee (assigned leads)</p>
            <ul className="mt-3 space-y-2 text-sm">
              {(data.perEmployee ?? []).length === 0 ? (
                <li className={muted}>No assignee breakdown</li>
              ) : (
                data.perEmployee!.map((r) => (
                  <li key={r.userId ?? r.name} className={muted}>
                    {r.name} — {r.leadCount} leads
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : !error ? (
        <p className={muted + " mt-6"}>Loading…</p>
      ) : null}
    </div>
  );
}
