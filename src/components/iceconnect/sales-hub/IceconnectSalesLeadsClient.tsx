"use client";

import { IceconnectCustomerPlan, IceconnectMetroStage } from "@prisma/client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";
import { CUSTOMER_PLAN_LABEL } from "@/lib/iceconnect-sales-hub";
import { MetroLine } from "./MetroLine";

type LeadItem = {
  id: string;
  name: string;
  phone: string;
  location: string;
  notes: string;
  stage: IceconnectMetroStage;
  stageLabel: string;
  status: string;
  createdAt: string;
  assigneeName: string;
  assigneeId: string | null;
  canEdit: boolean;
  won: boolean;
  lost: boolean;
};

type Stats = {
  openPipelineCount: number;
  conversionsThisMonth: number;
  targetCount: number;
  conversionPct: number;
};

type RangePreset = "all" | "today" | "week" | "month" | "custom";

function buildQuery(range: RangePreset, customFrom: string, customTo: string, pipeline: "open" | "lost") {
  const p = new URLSearchParams();
  p.set("pipeline", pipeline);
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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [range, setRange] = useState<RangePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [pipelineTab, setPipelineTab] = useState<"open" | "lost">("open");
  const [search, setSearch] = useState("");

  const [subOpen, setSubOpen] = useState<string | null>(null);
  const [subPlan, setSubPlan] = useState<IceconnectCustomerPlan>(IceconnectCustomerPlan.PRO);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const qs = buildQuery(range, customFrom, customTo, pipelineTab);
      const res = await fetch(`/api/iceconnect/executive/leads?${qs}`, { credentials: "include" });
      const j = (await res.json()) as {
        ok?: boolean;
        leads?: LeadItem[];
        stats?: Stats;
        view?: { manager?: boolean };
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
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }, [router, range, customFrom, customTo, pipelineTab]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        l.phone.toLowerCase().includes(q),
    );
  }, [leads, search]);

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setErr(null);
    try {
      const res = await fetch("/api/iceconnect/executive/leads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, location, notes }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not create lead");
        return;
      }
      setName("");
      setPhone("");
      setLocation("");
      setNotes("");
      setModalOpen(false);
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function advance(leadId: string) {
    setBusy(leadId);
    setErr(null);
    try {
      const res = await fetch("/api/iceconnect/executive/leads/stage", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance", leadId }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not update stage");
        return;
      }
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function subscribe(leadId: string) {
    setBusy(leadId);
    setErr(null);
    try {
      const res = await fetch("/api/iceconnect/executive/leads/stage", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe", leadId, customerPlan: subPlan }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not complete conversion");
        return;
      }
      setSubOpen(null);
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function markLost(leadId: string) {
    if (!window.confirm("Mark this lead as lost? It will leave the active pipeline.")) return;
    setBusy(leadId);
    setErr(null);
    try {
      const res = await fetch("/api/iceconnect/executive/leads/stage", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_lost", leadId }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not update lead");
        return;
      }
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(null);
    }
  }

  function onMetroActivate(l: LeadItem) {
    if (!l.canEdit || busy) return;
    if (l.stage === IceconnectMetroStage.PAYMENT_DONE) {
      setSubOpen(l.id);
      setSubPlan(IceconnectCustomerPlan.PRO);
      return;
    }
    void advance(l.id);
  }

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="mt-1 text-sm text-gray-500">
            Internal sales pipeline — metro stages, targets, and conversions
            {managerView ? (
              <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                Manager view · all reps
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <span className="text-lg leading-none">+</span>
          Create Lead
        </button>
      </div>

      {stats ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-3 rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50/40 p-4 shadow-sm sm:grid-cols-3"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Open pipeline
            </p>
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
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
                range === key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pipeline</span>
          <button
            type="button"
            onClick={() => setPipelineTab("open")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              pipelineTab === "open"
                ? "bg-emerald-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setPipelineTab("lost")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              pipelineTab === "lost"
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Lost
          </button>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Search</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or phone…"
            className="mt-2 w-full max-w-md rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-inner outline-none ring-indigo-500/30 focus:border-indigo-400 focus:ring-2"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          {pipelineTab === "open" ? "Active leads" : "Lost leads"}
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs font-medium text-indigo-600 hover:underline"
        >
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
          {pipelineTab === "open" && leads.length === 0 ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Create Lead
            </button>
          ) : null}
        </motion.div>
      ) : (
        <ul className="space-y-4">
          <AnimatePresence initial={false}>
            {filteredLeads.map((l) => (
              <motion.li
                key={l.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-semibold text-gray-900">{l.name}</p>
                      {l.won ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                          ✅ WON
                        </span>
                      ) : null}
                      {l.lost ? (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-700">
                          Lost
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-mono text-sm text-gray-700 tabular-nums">{l.phone}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>
                        Created {new Date(l.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </span>
                      <span>Assigned to {l.assigneeName}</span>
                      <span className="font-medium text-indigo-700">Status: {l.stageLabel}</span>
                    </div>
                    {l.location ? <p className="mt-1 text-xs text-gray-500">{l.location}</p> : null}
                  </div>
                  {pipelineTab === "open" && l.canEdit && !l.lost ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy === l.id}
                        onClick={() => void markLost(l.id)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                      >
                        Mark lost
                      </button>
                    </div>
                  ) : null}
                </div>

                {pipelineTab === "open" && !l.lost ? (
                  <div className="mt-5 border-t border-gray-100 pt-5">
                    <MetroLine
                      current={l.stage}
                      interactive={l.canEdit}
                      disabled={busy === l.id}
                      onActivateCurrent={() => onMetroActivate(l)}
                    />
                    {l.stage === IceconnectMetroStage.PAYMENT_DONE && l.canEdit ? (
                      <button
                        type="button"
                        disabled={busy === l.id}
                        onClick={() => {
                          setSubOpen(l.id);
                          setSubPlan(IceconnectCustomerPlan.PRO);
                        }}
                        className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        ✅ Convert to customer…
                      </button>
                    ) : null}
                    {subOpen === l.id ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-4 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"
                      >
                        <p className="text-sm font-medium text-gray-900">Choose plan — moves to Customers</p>
                        <select
                          value={subPlan}
                          onChange={(e) => setSubPlan(e.target.value as IceconnectCustomerPlan)}
                          className="mt-2 w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          {(Object.keys(CUSTOMER_PLAN_LABEL) as IceconnectCustomerPlan[]).map((p) => (
                            <option key={p} value={p}>
                              {CUSTOMER_PLAN_LABEL[p]}
                            </option>
                          ))}
                        </select>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy === l.id}
                            onClick={() => void subscribe(l.id)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Confirm conversion
                          </button>
                          <button
                            type="button"
                            onClick={() => setSubOpen(null)}
                            className="text-xs font-medium text-gray-600 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    ) : null}
                  </div>
                ) : pipelineTab === "lost" ? (
                  <p className="mt-3 text-xs text-gray-500">Final stage was: {l.stageLabel}</p>
                ) : null}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
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
    </div>
  );
}
