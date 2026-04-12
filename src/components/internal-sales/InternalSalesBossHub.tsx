"use client";

import { InternalCallStatus, InternalSalesStage } from "@prisma/client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  readDashboardPayload,
  readDefaultAssigneePayload,
  readError,
  readPipelinePayload,
  readTeamPayload,
} from "@/components/internal-sales/internal-sales-read-api";
import type { DashboardPayload } from "@/components/internal-sales/internal-sales-read-api";
import type { LeadCard, PipelineCol, TeamMember } from "@/components/internal-sales/internal-sales-types";
import { InternalNotificationsBell } from "./InternalNotificationsBell";
import { InternalSalesMetroStrip } from "./InternalSalesMetroStrip";
import { NexaSupportModal } from "./NexaSupportModal";
import { OnboardingStartModal } from "./OnboardingStartModal";

export function InternalSalesBossHub({ theme }: { theme: "bgos" | "ice" }) {
  const [pipeline, setPipeline] = useState<PipelineCol[]>([]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string | null>(null);
  const [range, setRange] = useState<"today" | "week" | "month">("today");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [onboardLead, setOnboardLead] = useState<LeadCard | null>(null);
  const [activityFor, setActivityFor] = useState<string | null>(null);
  const [activityRows, setActivityRows] = useState<
    { id: string; action: string; detail: string; createdAt: string; user: { name: string } | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCompany, setAddCompany] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addBiz, setAddBiz] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addAssignee, setAddAssignee] = useState("");
  const [dupExisting, setDupExisting] = useState<{ id: string; name: string } | null>(null);
  const [approvalRows, setApprovalRows] = useState<
    { id: string; name: string; phone: string; companyName: string | null; assignee: { name: string } | null }[]
  >([]);
  const [nexaOpen, setNexaOpen] = useState(false);

  const shell =
    theme === "bgos"
      ? "min-h-screen text-white"
      : "min-h-screen bg-slate-50 text-slate-900";
  const card =
    theme === "bgos"
      ? "rounded-xl border border-white/10 bg-white/[0.04] p-4"
      : "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
  const inputCls =
    theme === "bgos"
      ? "mt-1 w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-white/35"
      : "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";
  const labelCls = theme === "bgos" ? "text-xs font-medium text-white/70" : "text-xs font-medium text-slate-600";

  const onboardingHref = theme === "bgos" ? "/bgos/internal-onboarding" : "/iceconnect/internal-onboarding";

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filterEmployee === "unassigned") q.set("employeeId", "unassigned");
      else if (filterEmployee) q.set("employeeId", filterEmployee);
      if (filterStage) q.set("stage", filterStage);
      const qs = q.toString();
      const [plRes, dashRes, teamRes, setRes, apprRes] = await Promise.all([
        fetch(`/api/internal-sales/leads${qs ? `?${qs}` : ""}`, { credentials: "include" }),
        fetch(`/api/internal-sales/dashboard?range=${range}`, { credentials: "include" }),
        fetch("/api/internal-sales/team", { credentials: "include" }),
        fetch("/api/internal-sales/settings", { credentials: "include" }),
        fetch("/api/internal-sales/onboarding-approvals", { credentials: "include" }),
      ]);
      const plJson: unknown = await plRes.json();
      if (!plRes.ok) {
        setErr(readError(plJson, "Could not load pipeline."));
        setPipeline([]);
        return;
      }
      setPipeline(readPipelinePayload(plJson) ?? []);
      const dj: unknown = await dashRes.json();
      setDashboard(dashRes.ok ? readDashboardPayload(dj) : null);
      const tj: unknown = await teamRes.json();
      setTeam(teamRes.ok ? readTeamPayload(tj) ?? [] : []);
      const sj: unknown = await setRes.json();
      if (setRes.ok) setDefaultAssigneeId(readDefaultAssigneePayload(sj));
      const aj: unknown = await apprRes.json();
      if (apprRes.ok && aj && typeof aj === "object" && "leads" in aj && Array.isArray((aj as { leads: unknown }).leads)) {
        setApprovalRows((aj as { leads: typeof approvalRows }).leads);
      } else {
        setApprovalRows([]);
      }
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, [filterEmployee, filterStage, range]);

  useEffect(() => {
    void load();
  }, [load]);

  const funnelChart = useMemo(() => {
    const f = dashboard?.funnel;
    if (!f) return [];
    return [
      { name: "Leads", v: f.leads },
      { name: "Demo+", v: f.demoOrLater },
      { name: "Won", v: f.closedWon },
    ];
  }, [dashboard]);

  const dayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function patchLead(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/internal-sales/leads/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) setErr(readError(await res.json(), "Update failed."));
      else await load();
    } finally {
      setBusyId(null);
    }
  }

  async function bossDecision(leadId: string, decision: "approve" | "reject") {
    setBusyId(leadId);
    setErr(null);
    try {
      const res = await fetch(`/api/internal-sales/leads/${leadId}/boss-approval`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) setErr(readError(await res.json(), "Approval update failed."));
      else await load();
    } finally {
      setBusyId(null);
    }
  }

  async function loadActivity(leadId: string) {
    setActivityFor(leadId);
    const res = await fetch(`/api/internal-sales/leads/${leadId}/activity`, { credentials: "include" });
    const j = (await res.json()) as { ok?: boolean; activity?: typeof activityRows };
    if (res.ok && j.ok && Array.isArray(j.activity)) setActivityRows(j.activity);
    else setActivityRows([]);
  }

  async function runBulkAssign() {
    if (!bulkAssignee || selected.size === 0) return;
    setBusyId("bulk");
    try {
      const res = await fetch("/api/internal-sales/leads/bulk-assign", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [...selected], assignedToUserId: bulkAssignee }),
      });
      if (!res.ok) setErr(readError(await res.json(), "Bulk assign failed."));
      else {
        setSelected(new Set());
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function saveTarget(userId: string, targetLeads: number) {
    await fetch("/api/internal-sales/targets", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, dayKey, targetLeads }),
    });
    await load();
  }

  async function checkDup() {
    const p = addPhone.trim();
    const e = addEmail.trim();
    if (!p && !e) {
      setDupExisting(null);
      return;
    }
    const q = new URLSearchParams();
    if (p) q.set("phone", p);
    if (e) q.set("email", e);
    const res = await fetch(`/api/internal-sales/duplicate-check?${q}`, { credentials: "include" });
    const j = (await res.json()) as { duplicate?: boolean; existingLead?: { id: string; name: string } };
    if (res.ok && j.duplicate && j.existingLead) setDupExisting(j.existingLead);
    else setDupExisting(null);
  }

  async function submitAddLead(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusyId("new");
    try {
      const res = await fetch("/api/internal-sales/leads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          phone: addPhone.trim(),
          companyName: addCompany.trim() || undefined,
          email: addEmail.trim() || undefined,
          businessType: addBiz.trim() || undefined,
          notes: addNotes.trim() || undefined,
          ...(addAssignee.trim() ? { assignedToUserId: addAssignee.trim() } : {}),
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        details?: { existingLead?: { id: string; name: string } };
      };
      if (!res.ok) {
        setErr(readError(j, "Could not add lead."));
        if (j.details?.existingLead) setDupExisting(j.details.existingLead);
        return;
      }
      setAddName("");
      setAddCompany("");
      setAddPhone("");
      setAddEmail("");
      setAddBiz("");
      setAddNotes("");
      setAddAssignee("");
      setDupExisting(null);
      setFormOpen(false);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function saveDefaultAssignee(userId: string) {
    setBusyId("settings");
    try {
      await fetch("/api/internal-sales/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultAssigneeUserId: userId === "" ? null : userId }),
      });
      setDefaultAssigneeId(userId === "" ? null : userId);
    } finally {
      setBusyId(null);
    }
  }

  const totalLeads = useMemo(() => pipeline.reduce((n, c) => n + c.leads.length, 0), [pipeline]);

  function toggleSel(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  if (loading) {
    return (
      <div className={`${shell} flex items-center justify-center p-8`}>
        <p className={theme === "bgos" ? "text-white/60" : "text-slate-500"}>Loading…</p>
      </div>
    );
  }

  return (
    <div className={`${shell} px-4 pb-20 pt-6 sm:px-6`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Team control</h1>
            <p className={theme === "bgos" ? "mt-1 text-sm text-white/55" : "mt-1 text-sm text-slate-500"}>
              Filters, bulk assign, onboarding, and alerts
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <InternalNotificationsBell theme={theme} />
            <button
              type="button"
              onClick={() => setNexaOpen(true)}
              className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-100"
            >
              Nexa Support
            </button>
            <Link
              href={theme === "bgos" ? "/bgos/internal-tech" : "/iceconnect/internal-tech"}
              className="rounded-lg border border-slate-400/40 px-3 py-2 text-sm font-medium opacity-90"
            >
              Tech pipeline
            </Link>
            <Link
              href={onboardingHref}
              className="rounded-lg border border-indigo-400/50 bg-indigo-500/20 px-3 py-2 text-sm font-medium text-indigo-100"
            >
              Onboarding queue
            </Link>
            <button
              type="button"
              onClick={() => setFormOpen((v) => !v)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Add Lead
            </button>
          </div>
        </header>

        {err ? (
          <div
            role="alert"
            className={
              theme === "bgos"
                ? "rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100"
                : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            }
          >
            {err}
          </div>
        ) : null}

        {approvalRows.length > 0 ? (
          <section className={card}>
            <p className={labelCls}>Boss approval · onboarding</p>
            <ul className="mt-3 space-y-2 text-sm">
              {approvalRows.map((r) => (
                <li
                  key={r.id}
                  className={
                    theme === "bgos"
                      ? "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                      : "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  }
                >
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs opacity-70">
                      {r.companyName ?? "—"} · {r.assignee?.name ?? "Unassigned"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      onClick={() => void bossDecision(r.id, "approve")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      className={
                        theme === "bgos"
                          ? "rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                          : "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-50"
                      }
                      onClick={() => void bossDecision(r.id, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={`${card} flex flex-wrap gap-2`}>
          <span className={labelCls}>Trend</span>
          {(["today", "week", "month"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={
                range === r
                  ? "rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
                  : theme === "bgos"
                    ? "rounded-lg border border-white/10 px-3 py-1 text-xs text-white/80"
                    : "rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
              }
            >
              {r === "today" ? "Today" : r === "week" ? "Week" : "Month"}
            </button>
          ))}
        </section>

        {dashboard ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(
                [
                  ["Leads (range)", dashboard.metrics.rangeLeads ?? dashboard.metrics.leadsToday],
                  ["Calls today", dashboard.metrics.callsToday],
                  ["Demos", dashboard.metrics.demosScheduled],
                  ["Closed", dashboard.metrics.closedDeals],
                  ["Win %", `${dashboard.metrics.conversionPercent ?? 0}%`],
                ] as const
              ).map(([label, val]) => (
                <div key={label} className={card}>
                  <p className={labelCls}>{label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{val}</p>
                </div>
              ))}
            </section>

            {funnelChart.length > 0 ? (
              <section className={card}>
                <p className={labelCls}>Funnel</p>
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelChart}>
                      <XAxis dataKey="name" tick={{ fill: theme === "bgos" ? "#94a3b8" : "#64748b", fontSize: 11 }} />
                      <YAxis tick={{ fill: theme === "bgos" ? "#94a3b8" : "#64748b", fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: theme === "bgos" ? "#1e293b" : "#fff",
                          border: "1px solid #334155",
                        }}
                      />
                      <Bar dataKey="v" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : null}

            {dashboard.topPerformer ? (
              <section className={card}>
                <p className={labelCls}>Top performer</p>
                <p className="mt-2 text-lg font-semibold">
                  {dashboard.topPerformer.name}{" "}
                  <span className="text-indigo-300">Score {dashboard.topPerformer.score}</span>
                </p>
              </section>
            ) : null}

            {dashboard.automation ? (
              <section className="grid gap-3 lg:grid-cols-2">
                <div className={card}>
                  <p className={labelCls}>Automation · delayed & stuck</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {dashboard.automation.delayedLeads.slice(0, 8).map((l) => (
                      <li key={l.id}>
                        Delayed: {l.name}
                      </li>
                    ))}
                    {dashboard.automation.stuckFollowUp.slice(0, 8).map((l) => (
                      <li key={l.id}>Stuck follow-up: {l.name}</li>
                    ))}
                  </ul>
                </div>
                <div className={card}>
                  <p className={labelCls}>Daily summary</p>
                  <p className="mt-2 text-sm">
                    Leads {dashboard.automation.dailySummary.leadsToday} · Calls{" "}
                    {dashboard.automation.dailySummary.callsToday} · Win %{" "}
                    {dashboard.automation.dailySummary.conversionsPercent}
                  </p>
                </div>
              </section>
            ) : null}

            {dashboard.nexa?.suggestions?.length ? (
              <section className={card}>
                <p className={labelCls}>Nexa · suggested next steps</p>
                <ul className="mt-2 list-inside list-disc text-sm">
                  {dashboard.nexa.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {dashboard.alerts.length > 0 ? (
              <section className={card}>
                <p className={labelCls}>Risk & alerts</p>
                <ul className="mt-2 list-inside list-disc text-sm">
                  {dashboard.alerts.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}

        <section className={`${card} flex flex-wrap gap-3`}>
          <div>
            <span className={labelCls}>Employee</span>
            <select
              className={`${inputCls} min-w-[140px]`}
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
            >
              <option value="">All</option>
              <option value="unassigned">Unassigned</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={labelCls}>Stage</span>
            <select
              className={`${inputCls} min-w-[160px]`}
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
            >
              <option value="">All stages</option>
              {Object.values(InternalSalesStage).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </section>

        {dashboard ? (
          <section className={card}>
            <p className={labelCls}>Team table · daily targets ({dayKey})</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className={theme === "bgos" ? "text-white/50" : "text-slate-500"}>
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Leads</th>
                    <th className="py-2 pr-2">Calls</th>
                    <th className="py-2 pr-2">Win %</th>
                    <th className="py-2 pr-2">Score</th>
                    <th className="py-2">Target leads</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.employeePerformance.map((r) => (
                    <tr key={r.userId} className={theme === "bgos" ? "border-t border-white/10" : "border-t border-slate-100"}>
                      <td className="py-2 pr-2">{r.name}</td>
                      <td className="py-2 pr-2 tabular-nums">{r.leadsHandled}</td>
                      <td className="py-2 pr-2 tabular-nums">{r.callsMade}</td>
                      <td className="py-2 pr-2 tabular-nums">{r.conversions}%</td>
                      <td className="py-2 pr-2 tabular-nums">{r.performanceScore ?? "—"}</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min={0}
                          defaultValue={r.targetLeadsToday ?? 0}
                          className={`w-20 rounded border px-2 py-1 text-xs ${theme === "bgos" ? "border-white/20 bg-black/30 text-white" : "border-slate-200"}`}
                          onBlur={(e) => void saveTarget(r.userId, Number(e.target.value) || 0)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {selected.size > 0 ? (
          <section className={`${card} flex flex-wrap items-end gap-3`}>
            <div>
              <span className={labelCls}>Bulk assign ({selected.size})</span>
              <select
                className={inputCls}
                value={bulkAssignee}
                onChange={(e) => setBulkAssignee(e.target.value)}
              >
                <option value="">Pick teammate</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!bulkAssignee || busyId === "bulk"}
              className="min-h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void runBulkAssign()}
            >
              Assign selected
            </button>
            <button type="button" className="text-sm opacity-70" onClick={() => setSelected(new Set())}>
              Clear selection
            </button>
          </section>
        ) : null}

        <section className={card}>
          <p className={labelCls}>Public form default assignee</p>
          <p className="mt-1 text-[11px] text-amber-200/80">
            Public /lead capture is disabled — leads are sales-created only. This default is unused until you re-enable
            a public endpoint.
          </p>
          <select
            className={`${inputCls} mt-2 max-w-md`}
            value={defaultAssigneeId ?? ""}
            disabled={busyId === "settings"}
            onChange={(e) => void saveDefaultAssignee(e.target.value)}
          >
            <option value="">Unassigned</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </section>

        {formOpen ? (
          <form onSubmit={submitAddLead} className={`${card} space-y-3`}>
            <p className="font-semibold">New lead</p>
            {dupExisting ? (
              <div className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm">
                Already in system: {dupExisting.name}
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => {
                    setFilterEmployee("");
                    void load();
                  }}
                >
                  Refresh list
                </button>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}>Name</span>
                <input className={inputCls} value={addName} onChange={(e) => setAddName(e.target.value)} required />
              </label>
              <label className="block">
                <span className={labelCls}>Company</span>
                <input className={inputCls} value={addCompany} onChange={(e) => setAddCompany(e.target.value)} />
              </label>
              <label className="block">
                <span className={labelCls}>Phone</span>
                <input
                  className={inputCls}
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  onBlur={() => void checkDup()}
                  required
                />
              </label>
              <label className="block">
                <span className={labelCls}>Email</span>
                <input
                  className={inputCls}
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  onBlur={() => void checkDup()}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelCls}>Notes</span>
                <textarea className={`${inputCls} min-h-[72px]`} value={addNotes} onChange={(e) => setAddNotes(e.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelCls}>Assign to</span>
                <select className={inputCls} value={addAssignee} onChange={(e) => setAddAssignee(e.target.value)}>
                  <option value="">Me</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busyId === "new"} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                Save
              </button>
              <button type="button" className="text-sm opacity-80" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className={labelCls}>Pipeline · {totalLeads} leads</p>
            <button type="button" className="text-xs text-indigo-300" onClick={() => void load()}>
              Refresh
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {pipeline.map((col) => (
              <div
                key={col.key}
                className={
                  theme === "bgos"
                    ? "w-[min(100%,300px)] shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                    : "w-[min(100%,300px)] shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3"
                }
              >
                <p className="text-xs font-semibold uppercase opacity-70">{col.label}</p>
                <div className="mt-3 space-y-2">
                  {col.leads.map((l) => (
                    <article
                      key={l.id}
                      className={
                        theme === "bgos"
                          ? "rounded-lg border border-white/10 bg-[#0f1628] p-3 text-sm"
                          : "rounded-lg border border-slate-200 bg-white p-3"
                      }
                    >
                      <div className="flex gap-2">
                        <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSel(l.id)} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{l.name}</p>
                          <p className="text-xs opacity-70">{l.phone}</p>
                          <p className="mt-1 text-[11px] opacity-60">
                            Onboarding: {l.onboardingStatus ?? "NOT_STARTED"}
                          </p>
                          {l.onboardingType ? (
                            <p className="mt-0.5 text-[10px] font-medium text-amber-100/90">
                              {l.onboardingType === "BASIC"
                                ? "🟢 BASIC"
                                : l.onboardingType === "PRO"
                                  ? "🔵 PRO"
                                  : "🟣 ENTERPRISE"}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[10px] text-amber-200/70">Type not set</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <InternalSalesMetroStrip
                          stage={l.stage}
                          pendingBossApproval={l.pendingBossApproval}
                          theme={theme}
                          compact
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded bg-indigo-600/80 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-45"
                          disabled={
                            l.stage !== InternalSalesStage.INTERESTED ||
                            l.onboardingStatus === "COMPLETED" ||
                            l.onboardingStatus === "IN_PROGRESS"
                          }
                          onClick={() => setOnboardLead(l)}
                        >
                          Type & form
                        </button>
                        {l.stage === InternalSalesStage.TECH_READY ? (
                          <button
                            type="button"
                            className="rounded bg-emerald-600/90 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-45"
                            disabled={busyId === l.id}
                            onClick={() => void patchLead(l.id, { stage: InternalSalesStage.DELIVERED })}
                          >
                            Delivered to client
                          </button>
                        ) : null}
                        {l.stage === InternalSalesStage.DELIVERED ? (
                          <button
                            type="button"
                            className="rounded bg-teal-600/90 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-45"
                            disabled={busyId === l.id}
                            onClick={() => void patchLead(l.id, { stage: InternalSalesStage.CLIENT_LIVE })}
                          >
                            Client live
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded bg-slate-600/90 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-45"
                          disabled={busyId === l.id}
                          onClick={() => void patchLead(l.id, { advanceInternalSalesStage: true })}
                        >
                          Complete stage
                        </button>
                        <button
                          type="button"
                          className="rounded border border-white/15 px-2 py-1 text-[11px]"
                          onClick={() => void loadActivity(l.id)}
                        >
                          Timeline
                        </button>
                      </div>
                      {activityFor === l.id ? (
                        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-white/10 pt-2 text-[11px] opacity-80">
                          {activityRows.map((a) => (
                            <li key={a.id}>
                              {a.createdAt.slice(0, 16)} — {a.detail}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <label className="mt-2 block text-[10px] uppercase opacity-60">Update status</label>
                      <select
                        className={`${inputCls} text-xs`}
                        disabled={busyId === l.id}
                        value={l.stage}
                        onChange={(e) =>
                          void patchLead(l.id, { stage: e.target.value as InternalSalesStage })
                        }
                      >
                        {pipeline.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <label className="mt-2 block text-[10px] uppercase opacity-60">Call</label>
                      <select
                        className={`${inputCls} text-xs`}
                        disabled={busyId === l.id}
                        value={l.callStatus}
                        onChange={(e) =>
                          void patchLead(l.id, { callStatus: e.target.value as InternalCallStatus })
                        }
                      >
                        {Object.values(InternalCallStatus).map((c) => (
                          <option key={c} value={c}>
                            {c.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                      <label className="mt-2 block text-[10px] uppercase opacity-60">Assign</label>
                      <select
                        className={`${inputCls} text-xs`}
                        disabled={busyId === l.id}
                        value={l.assignedTo ?? ""}
                        onChange={(e) =>
                          void patchLead(l.id, {
                            assignedToUserId: e.target.value === "" ? null : e.target.value,
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {team.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {onboardLead ? (
        <OnboardingStartModal
          lead={onboardLead}
          theme={theme}
          onClose={() => setOnboardLead(null)}
          onDone={() => void load()}
        />
      ) : null}

      {nexaOpen ? (
        <NexaSupportModal
          theme={theme}
          leadId={null}
          onClose={() => setNexaOpen(false)}
          onDone={() => void load()}
        />
      ) : null}
    </div>
  );
}
