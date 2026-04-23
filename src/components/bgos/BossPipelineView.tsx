"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { getTeamLabel } from "@/lib/role-display";
import { BossPayroll } from "./BossPayroll";

type NewSignup = {
  id: string;
  leadCompanyName: string;
  email: string | null;
  phone: string;
  createdAt: string;
  assignedTo: string | null;
  bdmName: string;
};
type ActiveOnboarding = {
  id: string;
  leadCompanyName: string;
  industry: string | null;
  bdmName: string;
  stage: string;
  daysActive: number;
};
type ActiveBuild = {
  id: string;
  companyName: string;
  type: string;
  priority: string;
  sdeName: string;
  status: string;
  createdAt: string;
};
type DeliveredItem = {
  id: string;
  companyName: string;
  deliveredAt: string;
  bdmName: string;
};
type BdmStat = {
  userId: string;
  name: string;
  email: string;
  leadsThisMonth: number;
  onboardingsActive: number;
  deliveredThisMonth: number;
};
type SdeStat = {
  userId: string;
  name: string;
  email: string;
  buildsActive: number;
  buildsCompletedThisMonth: number;
  urgentPending: number;
};
type PipelinePayload = {
  newSignups: { count: number; leads: NewSignup[] };
  activeOnboardings: { count: number; items: ActiveOnboarding[] };
  activeBuilds: { count: number; items: ActiveBuild[] };
  deliveredThisMonth: { count: number; items: DeliveredItem[] };
  teamStats: { bdm: BdmStat[]; sde: SdeStat[] };
  summary: {
    totalActiveClients: number;
    newSignupsToday: number;
    buildsInProgress: number;
    deliveredThisMonth: number;
  };
  activityFeed: Array<{ id: string; text: string; createdAt: string }>;
};

type PipelineTab = "signups" | "onboarding" | "builds" | "delivered" | "payroll";

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

function daysTone(days: number): string {
  if (days < 3) return "text-emerald-300";
  if (days <= 7) return "text-amber-300";
  return "text-rose-300";
}

function pct(v: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((v / target) * 100)));
}

export function BossPipelineView() {
  const [data, setData] = useState<PipelinePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<PipelineTab>("signups");
  const [summary, setSummary] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/boss/pipeline", { credentials: "include" });
      const body = (await res.json()) as PipelinePayload & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load pipeline");
      setData(body);
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pipeline");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await apiFetch("/api/boss/nexa-summary", { credentials: "include" });
      const body = (await res.json()) as { summary?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load Nexa summary");
      setSummary(body.summary ?? "Nexa briefing unavailable");
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "Nexa briefing unavailable");
      setSummary("");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadPipeline(), loadSummary()]);
  }, [loadPipeline, loadSummary]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const tabs = useMemo(
    () =>
      [
        { id: "signups", label: "New Signups" },
        { id: "onboarding", label: "Onboarding" },
        { id: "builds", label: "Builds" },
        { id: "delivered", label: "Delivered" },
        { id: "payroll", label: "Payroll" },
      ] as const,
    [],
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-5 pt-3 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Company Pipeline</h2>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span>Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString("en-IN") : "—"}</span>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="rounded-md border border-white/20 bg-white/5 px-2.5 py-1 text-xs text-white/85 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="Active Clients" value={data?.summary.totalActiveClients ?? 0} />
        <StatCard
          label="New Signups Today"
          value={data?.summary.newSignupsToday ?? 0}
          tone={(data?.summary.newSignupsToday ?? 0) > 0 ? "red" : "default"}
        />
        <StatCard label="Builds In Progress" value={data?.summary.buildsInProgress ?? 0} tone="blue" />
        <StatCard label="Delivered This Month" value={data?.summary.deliveredThisMonth ?? 0} tone="green" />
      </div>

      <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-4">
        <p className="text-sm font-semibold text-cyan-100">🤖 Nexa says:</p>
        {summaryLoading ? (
          <p className="mt-1 text-sm text-white/75">Nexa is thinking...</p>
        ) : summaryError ? (
          <p className="mt-1 text-sm text-rose-200">Nexa briefing unavailable</p>
        ) : (
          <p className="mt-1 text-sm text-white/85">{summary}</p>
        )}
        <p className="mt-2 text-[11px] text-white/55">Refreshed: {lastUpdated ? new Date(lastUpdated).toLocaleString("en-IN") : "—"}</p>
      </div>

      {loading ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">Loading pipeline...</div>
      ) : error ? (
        <div className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>
      ) : data ? (
        <>
          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 xl:col-span-2">
              <div className="mb-3 flex flex-wrap gap-2">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      tab === t.id ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-300/35" : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === "signups" ? (
                <div className="space-y-2">
                  {data.newSignups.leads.length === 0 ? (
                    <p className="text-sm text-white/60">No new signups waiting</p>
                  ) : (
                    data.newSignups.leads.map((lead) => (
                      <div key={lead.id} className="grid gap-1 rounded-lg border border-white/10 bg-black/20 p-2 text-xs sm:grid-cols-5">
                        <p className="font-semibold text-white/90">{lead.leadCompanyName}</p>
                        <p className="text-white/70">{lead.email ?? "No email"}</p>
                        <a href={`tel:${lead.phone}`} className="font-semibold text-cyan-200 hover:underline">
                          {lead.phone}
                        </a>
                        <p className="text-white/75">{lead.bdmName}</p>
                        <p className="text-white/55">{timeAgo(lead.createdAt)} ago</p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {tab === "onboarding" ? (
                <div className="space-y-2">
                  {data.activeOnboardings.items.length === 0 ? (
                    <p className="text-sm text-white/60">No active onboardings</p>
                  ) : (
                    data.activeOnboardings.items.map((row) => (
                      <div key={row.id} className="grid gap-1 rounded-lg border border-white/10 bg-black/20 p-2 text-xs sm:grid-cols-5">
                        <p className="font-semibold text-white/90">{row.leadCompanyName}</p>
                        <p className="text-white/75">{row.industry ?? "—"}</p>
                        <p className="text-white/75">{row.bdmName}</p>
                        <p className="text-white/70">{row.stage}</p>
                        <p className={daysTone(row.daysActive)}>{row.daysActive} days</p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {tab === "builds" ? (
                <div className="space-y-2">
                  {data.activeBuilds.items.length === 0 ? (
                    <p className="text-sm text-white/60">No active builds</p>
                  ) : (
                    data.activeBuilds.items.map((row) => (
                      <div
                        key={row.id}
                        className={`grid gap-1 rounded-lg border bg-black/20 p-2 text-xs sm:grid-cols-5 ${row.priority === "URGENT" ? "border-l-4 border-l-rose-400 border-white/10" : "border-white/10"}`}
                      >
                        <p className="font-semibold text-white/90">{row.companyName}</p>
                        <p className="text-white/75">{row.type}</p>
                        <p className={row.priority === "URGENT" ? "font-semibold text-rose-300" : "text-white/70"}>{row.priority}</p>
                        <p className="text-white/75">{row.sdeName}</p>
                        <p className="text-white/70">{row.status}</p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {tab === "payroll" ? <BossPayroll /> : null}

              {tab === "delivered" ? (
                <div className="space-y-2">
                  {data.deliveredThisMonth.items.length === 0 ? (
                    <p className="text-sm text-white/60">No deliveries this month yet</p>
                  ) : (
                    data.deliveredThisMonth.items.map((row) => (
                      <div key={row.id} className="grid gap-1 rounded-lg border border-white/10 bg-black/20 p-2 text-xs sm:grid-cols-3">
                        <p className="font-semibold text-white/90">{row.companyName}</p>
                        <p className="text-white/75">{row.bdmName}</p>
                        <p className="text-white/60">{new Date(row.deliveredAt).toLocaleDateString("en-IN")}</p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-semibold text-white">Franchise Network Performance</p>
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wider text-white/50">{getTeamLabel("BDM")}</p>
                <div className="mt-2 space-y-2">
                  {data.teamStats.bdm.map((m) => {
                    const progress = pct(m.deliveredThisMonth, 5);
                    return (
                      <div key={m.userId} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
                        <p className="font-semibold text-white/90">{m.name}</p>
                        <p className="text-white/65">Leads this month: {m.leadsThisMonth}</p>
                        <p className="text-white/65">Active onboardings: {m.onboardingsActive}</p>
                        <p className="text-white/65">Delivered: {m.deliveredThisMonth}</p>
                        <div className="mt-1 h-1.5 w-full rounded bg-white/10">
                          <div className="h-1.5 rounded bg-cyan-300" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider text-white/50">SDE Team</p>
                <div className="mt-2 space-y-2">
                  {data.teamStats.sde.map((m) => (
                    <div key={m.userId} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
                      <p className="font-semibold text-white/90">{m.name}</p>
                      <p className="text-white/65">Active builds: {m.buildsActive}</p>
                      <p className="text-white/65">Completed this month: {m.buildsCompletedThisMonth}</p>
                      <p className={m.urgentPending > 0 ? "font-semibold text-rose-300" : "text-white/65"}>
                        Urgent pending: {m.urgentPending}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-semibold text-white">Activity Feed</p>
            <div className="mt-2 space-y-2">
              {data.activityFeed.length === 0 ? (
                <p className="text-sm text-white/60">No recent activity</p>
              ) : (
                data.activityFeed.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
                    <p className="text-white/85">{a.text}</p>
                    <span className="text-white/50">{timeAgo(a.createdAt)} ago</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "red" | "blue" | "green" }) {
  const toneClass =
    tone === "red"
      ? "border-rose-300/30 bg-rose-500/10"
      : tone === "blue"
        ? "border-cyan-300/30 bg-cyan-500/10"
        : tone === "green"
          ? "border-emerald-300/30 bg-emerald-500/10"
          : "border-white/10 bg-white/[0.03]";
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wider text-white/60">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
