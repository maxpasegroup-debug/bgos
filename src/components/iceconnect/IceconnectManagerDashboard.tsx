"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import { OnboardBossButton } from "@/components/onboarding/OnboardBossButton";

type ManagerData = {
  summary: {
    managerName: string;
    totalRevenue: number;
    activeLeads: number;
    teamPerformancePct: number;
  };
  team: Array<{
    id: string;
    name: string;
    email: string;
    leadsAssigned: number;
    conversionPct: number;
    revenueGenerated: number;
    target: number;
    achieved: number;
  }>;
  franchises: Array<{
    id: string;
    name: string;
    region: string;
    leadsHandled: number;
    revenueContribution: number;
  }>;
  pipeline: Array<{ key: string; label: string; color: string; count: number }>;
  analytics: {
    dailySales: Array<{ label: string; value: number }>;
    weeklyPerformance: Array<{ label: string; value: number }>;
    topPerformers: Array<{ name: string; revenueGenerated: number }>;
  };
  alerts: {
    underperformers: string[];
    unattendedHotLeads: Array<{ id: string; name: string }>;
  };
};

type PipelineRow = {
  id: string;
  companyName: string;
  status: string;
  stage: string;
  salesOwner: { id: string; name: string; email: string } | null;
  leadId: string;
  customerCompanyId: string | null;
};

export function IceconnectManagerDashboard() {
  const [data, setData] = useState<ManagerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/manager/dashboard", { credentials: "include" });
      const json = ((await readApiJson(res, "manager-dashboard")) ?? {}) as {
        success?: boolean;
        data?: ManagerData;
        message?: string;
      };
      if (!res.ok || json.success !== true || !json.data) {
        setError(json.message || "Failed to load manager dashboard");
        setData(null);
        return;
      }
      setData(json.data);
    } catch (e) {
      setError(formatFetchFailure(e, "Failed to load manager dashboard"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    const id = window.setInterval(() => void loadDashboard(), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const loadPipeline = useCallback(async () => {
    setPipelineLoading(true);
    setPipelineError(null);
    try {
      const res = await apiFetch("/api/onboarding/pipeline", { credentials: "include" });
      const j = ((await readApiJson(res, "onboarding-pipeline")) ?? {}) as {
        success?: boolean;
        data?: PipelineRow[];
        message?: string;
      };
      if (!res.ok || j.success !== true || !Array.isArray(j.data)) {
        setPipeline([]);
        setPipelineError(j.message || "Could not load onboarding pipeline");
        return;
      }
      setPipeline(j.data);
    } catch (e) {
      setPipeline([]);
      setPipelineError(formatFetchFailure(e, "Could not load onboarding pipeline"));
    } finally {
      setPipelineLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPipeline();
    const id = window.setInterval(() => void loadPipeline(), 45_000);
    return () => window.clearInterval(id);
  }, [loadPipeline]);

  if (loading) {
    return <div className="text-sm text-white/70">Loading manager dashboard...</div>;
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-100">
        <p>{error || "Failed to load manager dashboard"}</p>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="mt-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <OnboardBossButton />
      </div>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Boss onboarding pipeline</h2>
          <button
            type="button"
            onClick={() => void loadPipeline()}
            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
        {pipelineLoading ? (
          <p className="text-xs text-white/55">Loading pipeline…</p>
        ) : pipelineError ? (
          <p className="text-xs text-rose-200">{pipelineError}</p>
        ) : pipeline.length === 0 ? (
          <p className="text-xs text-white/55">No onboarding rows yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left text-xs text-white/85">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wide text-white/45">
                  <th className="py-2 pr-3 font-semibold">Company</th>
                  <th className="py-2 pr-3 font-semibold">Stage</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Sales owner</th>
                </tr>
              </thead>
              <tbody>
                {pipeline.map((row) => (
                  <tr key={row.id} className="border-b border-white/[0.06]">
                    <td className="py-2 pr-3 font-medium text-white">{row.companyName}</td>
                    <td className="py-2 pr-3 capitalize">{row.stage.replace("_", " ")}</td>
                    <td className="py-2 pr-3">{row.status}</td>
                    <td className="py-2 text-white/70">
                      {row.salesOwner ? `${row.salesOwner.name} · ${row.salesOwner.email}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/60">Manager</p>
          <p className="text-sm font-semibold text-white">{data.summary.managerName}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/60">Team Performance</p>
          <p className="text-xl font-semibold text-white">{data.summary.teamPerformancePct}%</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/60">Total Revenue</p>
          <p className="text-xl font-semibold text-white">Rs {Math.round(data.summary.totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/60">Active Leads</p>
          <p className="text-xl font-semibold text-white">{data.summary.activeLeads}</p>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Team Overview</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {data.team.map((t) => (
            <a key={t.id} href={`/bgos/control/team?employee=${t.id}`} className="rounded-lg border border-white/10 p-3">
              <p className="text-sm font-semibold text-white">{t.name}</p>
              <p className="text-xs text-white/60">
                Leads {t.leadsAssigned} | Conv {t.conversionPct}% | Revenue {Math.round(t.revenueGenerated)}
              </p>
              <p className="text-xs text-white/60">
                Target {t.target} | Achieved {t.achieved}
              </p>
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Micro Franchise Control</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {data.franchises.map((f) => (
            <div key={f.id} className="rounded-lg border border-white/10 p-3 text-xs text-white/80">
              <p className="text-sm font-semibold text-white">{f.name}</p>
              <p>{f.region}</p>
              <p>Leads handled: {f.leadsHandled}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Live Pipeline View</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {data.pipeline.map((p) => (
            <div key={p.key} className="rounded-lg border border-white/10 p-3">
              <p className="text-xs text-white/60">{p.label}</p>
              <p className="text-lg font-semibold text-white">{p.count}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Performance Analytics</h2>
        <p className="text-xs text-white/70">
          Daily sales, weekly performance, and top performers are auto refreshed every 30 seconds.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {data.analytics.topPerformers.map((p) => (
            <div key={p.name} className="rounded-lg border border-white/10 p-2 text-xs text-white/80">
              {p.name}: Rs {Math.round(p.revenueGenerated)}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Target Control</h2>
        <p className="text-xs text-white/70">
          Set and update targets in the People panel. Click a team member card to open employee controls.
        </p>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Alerts</h2>
        <p className="text-xs text-white/70">
          Underperforming: {data.alerts.underperformers.length ? data.alerts.underperformers.join(", ") : "None"}
        </p>
        <p className="mt-2 text-xs text-white/70">
          Hot unattended leads:{" "}
          {data.alerts.unattendedHotLeads.length
            ? data.alerts.unattendedHotLeads.map((l) => l.name).join(", ")
            : "None"}
        </p>
      </section>
    </div>
  );
}
