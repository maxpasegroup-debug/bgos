"use client";

import type { IceconnectMetroStage } from "@prisma/client";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";
import type { LeadFlowV3Selection, LeadFlowV3Stage } from "@/lib/iceconnect-lead-flow-v3";
import { LEAD_FLOW_V3_LABEL } from "@/lib/iceconnect-lead-flow-v3";

type LeadItem = {
  id: string;
  name: string;
  phone: string;
  companyName: string;
  industry: string;
  location: string;
  notes: string;
  stage: LeadFlowV3Stage;
  stageLabel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  nextFollowUpAt: string | null;
  assigneeName: string;
  assigneeId: string | null;
  ownerUserId?: string | null;
  ownerRole?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  iceconnectMetroStage?: IceconnectMetroStage;
  canEdit: boolean;
  won: boolean;
  lost: boolean;
  livePlanLabel: string | null;
  onboardingFormId: string | null;
  onboardingIndustry: string | null;
  formStatus: string;
  techStatus: string | null;
};

type Stats = {
  openPipelineCount: number;
  conversionsThisMonth: number;
  targetCount: number;
  conversionPct: number;
};

type RangePreset = "all" | "today" | "week" | "month" | "custom";
type StatusFilter = "active" | "onboarding" | "live" | "lost";

type AssigneeOption = { id: string; name: string | null; email: string };

const CRM_STAGES: LeadFlowV3Stage[] = [
  "NEW",
  "INTRODUCED",
  "DEMO",
  "FOLLOW_UP",
  "ONBOARD",
  "SUBSCRIPTION",
];

function buildQuery(range: RangePreset, customFrom: string, customTo: string, statusFilter: StatusFilter) {
  const p = new URLSearchParams();
  p.set("statusFilter", statusFilter);
  if (range === "today") p.set("range", "today");
  else if (range === "week") p.set("range", "week");
  else if (range === "month") p.set("range", "month");
  else if (range === "custom" && customFrom && customTo) {
    p.set("range", "custom");
    p.set("from", customFrom);
    p.set("to", customTo);
  }
  return p.toString();
}

export function IceconnectSalesLeadsClient() {
  const router = useRouter();
  const { ready } = useCompanyBranding();
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [managerView, setManagerView] = useState(false);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [range, setRange] = useState<RangePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<"" | LeadFlowV3Stage>("");
  const [industryFilter, setIndustryFilter] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editLead, setEditLead] = useState<LeadItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [duplicateLead, setDuplicateLead] = useState<{ id: string; name: string; owner?: { id?: string; name?: string; email?: string } | null } | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const qs = buildQuery(range, customFrom, customTo, statusFilter);
      const res = await apiFetch(`/api/iceconnect/executive/leads?${qs}`, { credentials: "include" });
      const j = (await res.json()) as {
        ok?: boolean;
        leads?: LeadItem[];
        stats?: Stats;
        view?: { manager?: boolean; assignees?: AssigneeOption[] };
        code?: string;
        error?: string;
      };
      if (res.status === 403 && j.code === "NOT_INTERNAL_SALES_ORG") {
        router.replace("/iceconnect/internal-sales");
        return;
      }
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load leads");
        return;
      }
      setLeads(j.leads ?? []);
      if (j.stats) setStats(j.stats);
      setManagerView(j.view?.manager === true);
      setAssignees(Array.isArray(j.view?.assignees) ? j.view!.assignees! : []);
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, [router, range, customFrom, customTo, statusFilter]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (stageFilter && l.stage !== stageFilter) return false;
      if (industryFilter.trim() && l.industry.trim() !== industryFilter.trim()) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.companyName.toLowerCase().includes(q) ||
        l.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        l.phone.toLowerCase().includes(q)
      );
    });
  }, [leads, search, stageFilter, industryFilter]);

  const leadsByStage = useMemo(() => {
    const map = new Map<LeadFlowV3Stage, LeadItem[]>();
    for (const s of CRM_STAGES) map.set(s, []);
    for (const l of filteredLeads) {
      if (l.lost) continue;
      const list = map.get(l.stage);
      list?.push(l);
    }
    return map;
  }, [filteredLeads]);

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setErr(null);
    setDuplicateLead(null);
    try {
      const res = await apiFetch("/api/iceconnect/executive/leads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, location, industry, notes }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        existing?: { id?: string; name?: string; owner?: { id?: string; name?: string; email?: string } | null };
      };
      if (!res.ok || !j.ok) {
        if (j.code === "COMPANY_EXISTS" && j.existing?.id) {
          setDuplicateLead({ id: j.existing.id, name: j.existing.name ?? "Existing lead", owner: j.existing.owner ?? null });
          setErr("Company already exists");
        } else {
          setErr(j.error ?? "Could not create lead");
        }
        return;
      }
      setName("");
      setPhone("");
      setIndustry("");
      setLocation("");
      setNotes("");
      setModalOpen(false);
      await load();
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setBusy(null);
    }
  }

  async function requestOwnership() {
    if (!duplicateLead) return;
    setBusy("claim");
    setErr(null);
    try {
      const res = await apiFetch("/api/ownership-claims", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: duplicateLead.id }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not request ownership");
        return;
      }
      setErr("Ownership request sent to RSM.");
      setDuplicateLead(null);
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not request ownership"));
    } finally {
      setBusy(null);
    }
  }

  async function updateStage(leadId: string, stage: LeadFlowV3Selection) {
    setBusy(leadId);
    setErr(null);
    try {
      const res = await apiFetch("/api/iceconnect/executive/leads/stage", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_stage", leadId, stage }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not update status");
        return;
      }
      await load();
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setBusy(null);
    }
  }

  async function updateAssignee(leadId: string, assigneeId: string) {
    setBusy(leadId);
    setErr(null);
    try {
      const res = await apiFetch("/api/iceconnect/executive/leads/stage", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_assignee", leadId, assigneeId }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not reassign lead");
        return;
      }
      await load();
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setBusy(null);
    }
  }

  async function saveLeadEdits(e: React.FormEvent) {
    e.preventDefault();
    if (!editLead) return;
    setBusy(`edit-${editLead.id}`);
    setErr(null);
    try {
      const res = await apiFetch(`/api/iceconnect/executive/leads/${editLead.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          industry: editIndustry,
          location: editLocation,
          notes: editNotes,
        }),
      });
      const j = ((await readApiJson(res, "leads/patch")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok !== true) {
        setErr(j.error ?? "Could not save lead");
        return;
      }
      setEditOpen(false);
      setEditLead(null);
      await load();
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not save lead"));
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pure CRM pipeline — track stages only. Onboarding runs in the Onboarding module.
            {managerView ? (
              <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                Manager view · all reps
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/onboarding/nexa?source=sales"
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
          >
            Open Onboarding
          </Link>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <span className="text-lg leading-none">+</span>
            Create Lead
          </button>
        </div>
      </div>

      {stats ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-3 rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50/40 p-4 shadow-sm sm:grid-cols-3"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Open pipeline</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.openPipelineCount}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Conversions (this month)
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.conversionsThisMonth}</p>
            {stats.targetCount > 0 ? (
              <p className="text-xs text-gray-600">
                Target {stats.targetCount} · {stats.conversionPct}% of goal
              </p>
            ) : null}
          </div>
          <div className="flex flex-col justify-center sm:items-end">
            <Link
              href="/iceconnect/my-journey"
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Performance &amp; targets →
            </Link>
            <Link
              href="/iceconnect/customers"
              className="mt-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline"
            >
              View converted customers
            </Link>
          </div>
        </motion.div>
      ) : null}

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Period</span>
          {(
            [
              ["all", "All"],
              ["today", "Today"],
              ["week", "This week"],
              ["month", "This month"],
              ["custom", "Custom"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                range === key ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {range === "custom" ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-600">
              From
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-1 block rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600">
              To
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="mt-1 block rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</span>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              statusFilter === "active" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("onboarding")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              statusFilter === "onboarding"
                ? "bg-amber-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Onboard stage
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("live")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              statusFilter === "live" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Subscription
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("lost")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              statusFilter === "lost" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Lost
          </button>
        </div>

        <div className="grid gap-3 border-t border-gray-100 pt-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Search</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone, or company…"
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-inner outline-none ring-indigo-500/30 focus:border-indigo-400 focus:ring-2"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Stage</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter((e.target.value || "") as "" | LeadFlowV3Stage)}
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            >
              <option value="">All stages</option>
              {CRM_STAGES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_FLOW_V3_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Industry</label>
            <input
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              placeholder="Exact match"
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Kanban</h2>
        <button type="button" onClick={() => void load()} className="text-xs font-medium text-indigo-600 hover:underline">
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : filteredLeads.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 px-6 py-16 text-center"
        >
          <p className="text-sm font-medium text-gray-700">
            {leads.length > 0
              ? "No leads match your search or filters."
              : "No leads yet. Start by creating your first lead."}
          </p>
          {statusFilter !== "lost" && leads.length === 0 ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Create Lead
            </button>
          ) : null}
        </motion.div>
      ) : statusFilter === "lost" ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-900">Lost leads</p>
          <ul className="mt-3 divide-y divide-gray-100">
            {filteredLeads.map((l) => (
              <li key={l.id} className="py-3 text-sm">
                <p className="font-semibold text-gray-900">{l.name}</p>
                <p className="text-xs text-gray-600">{l.phone}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-[1100px] gap-3">
            {CRM_STAGES.map((stage) => (
              <section
                key={stage}
                className="w-64 shrink-0 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{LEAD_FLOW_V3_LABEL[stage]}</p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                    {(leadsByStage.get(stage) ?? []).length}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {(leadsByStage.get(stage) ?? []).map((l) => (
                    <motion.div
                      key={l.id}
                      layout
                      className="rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-3 shadow-sm"
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => {
                          setEditLead(l);
                          setEditName(l.name);
                          setEditPhone(l.phone);
                          setEditIndustry(l.industry);
                          setEditLocation(l.location);
                          setEditNotes(l.notes);
                          setEditOpen(true);
                        }}
                      >
                        <p className="text-sm font-semibold text-gray-900">{l.name}</p>
                        <p className="mt-0.5 font-mono text-xs text-gray-700 tabular-nums">{l.phone}</p>
                        {l.companyName ? <p className="mt-1 text-xs text-gray-600">Co: {l.companyName}</p> : null}
                        {l.industry ? <p className="text-xs text-indigo-700">Industry: {l.industry}</p> : null}
                        {l.location ? <p className="text-xs text-gray-500">{l.location}</p> : null}
                        <p className="text-[11px] text-gray-500">
                          Owned by: {l.ownerName ?? l.assigneeName} {l.ownerRole ? `(${l.ownerRole})` : ""}
                        </p>
                      </button>

                      {l.canEdit ? (
                        <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
                          <select
                            value={l.lost ? "LOST" : l.stage}
                            onChange={(e) => void updateStage(l.id, e.target.value as LeadFlowV3Selection)}
                            disabled={busy === l.id}
                            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-gray-800"
                          >
                            {CRM_STAGES.map((s) => (
                              <option key={s} value={s}>
                                {LEAD_FLOW_V3_LABEL[s]}
                              </option>
                            ))}
                            <option value="LOST">Lost</option>
                          </select>

                          {managerView && assignees.length > 0 ? (
                            <select
                              value={l.assigneeId ?? ""}
                              onChange={(e) => void updateAssignee(l.id, e.target.value)}
                              disabled={busy === l.id}
                              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-gray-800"
                            >
                              {assignees.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {(a.name?.trim() || a.email) ?? a.id}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      ) : null}
                    </motion.div>
                  ))}
                  {(leadsByStage.get(stage) ?? []).length === 0 ? (
                    <p className="text-[11px] text-gray-400">Drop cards here (use stage dropdown)</p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {modalOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalOpen(false)}
            role="presentation"
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-gray-900">New lead</h2>
              <p className="mt-1 text-sm text-gray-500">Assigned to you automatically.</p>
              <form onSubmit={(e) => void createLead(e)} className="mt-6 space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">Name *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none ring-indigo-500/20 focus:border-indigo-400 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Phone *</label>
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none ring-indigo-500/20 focus:border-indigo-400 focus:ring-2"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">Must be unique for your workspace.</p>
                </div>
                {duplicateLead ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                    Company already exists: <strong>{duplicateLead.name}</strong>
                    <br />
                    Owned by: {duplicateLead.owner?.name ?? duplicateLead.owner?.email ?? "Existing owner"}
                    <div className="mt-2 flex gap-2">
                      <Link href={`/iceconnect/leads?leadId=${duplicateLead.id}`} className="rounded-lg border border-amber-300 px-2 py-1 font-semibold">
                        View existing
                      </Link>
                      <button type="button" onClick={() => void requestOwnership()} className="rounded-lg bg-amber-600 px-2 py-1 font-semibold text-white">
                        {busy === "claim" ? "Sending..." : "Request ownership"}
                      </button>
                    </div>
                  </div>
                ) : null}
                <div>
                  <label className="text-xs font-medium text-gray-600">Industry</label>
                  <input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="Solar, Education, Healthcare, Custom…"
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Location</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy === "create"}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {busy === "create" ? "Saving…" : "Save Lead"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {editOpen && editLead ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setEditOpen(false);
              setEditLead(null);
            }}
            role="presentation"
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-gray-900">Edit lead</h2>
              <p className="mt-1 text-sm text-gray-500">CRM fields only — onboarding is separate.</p>
              <form onSubmit={(e) => void saveLeadEdits(e)} className="mt-6 space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">Name *</label>
                  <input
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Phone *</label>
                  <input
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Industry</label>
                  <input
                    value={editIndustry}
                    onChange={(e) => setEditIndustry(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Location</label>
                  <input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditOpen(false);
                      setEditLead(null);
                    }}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy === `edit-${editLead.id}`}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
