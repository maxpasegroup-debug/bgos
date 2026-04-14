"use client";

import type { LeadStatus } from "@prisma/client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UserManualCategory } from "@prisma/client";
import { BgosAddLeadModal } from "./BgosAddLeadModal";
import { BGOS_MAIN_PAD } from "./layoutTokens";
import { ViewModuleGuideButton } from "./ViewModuleGuideButton";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type RangePreset = "today" | "this_month" | "3_months" | "1_year";

type SalesLead = {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  value: number | null;
  assignedTo: string | null;
  createdByUserId: string | null;
  assignee: { id: string; name: string; email: string } | null;
};

type PipelineStage = {
  key: string;
  label: string;
  statuses: LeadStatus[];
  count: number;
  leads: SalesLead[];
};

type SalesData = {
  metrics: {
    totalLeads: number;
    dealsWon: number;
    conversionPercent: number;
    revenueGenerated: number;
  };
  pipeline: PipelineStage[];
  team: {
    userId: string;
    name: string;
    leadsHandled: number;
    dealsClosed: number;
    conversionPercent: number;
    revenue: number;
  }[];
  insights: {
    followUpsPending: number;
    stuckNegotiation: number;
    insightLines: string[];
    suggestionLines: string[];
  };
  employees: { id: string; name: string }[];
  currentUserId: string;
};

type LeadDetail = {
  lead: {
    id: string;
    name: string;
    phone: string;
    stage: LeadStatus;
    assignedToUserId: string | null;
    createdByUserId: string | null;
    dealValue: number | null;
    notes: string;
  };
  activity: {
    id: string;
    message: string;
    createdAt: string;
    user: { id: string; name: string } | null;
  }[];
};

const ranges: { id: RangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "this_month", label: "This Month" },
  { id: "3_months", label: "3 Months" },
  { id: "1_year", label: "Year" },
];

function inr(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function nextStatusForStage(stageKey: string): LeadStatus {
  if (stageKey === "NEW") return "NEW";
  if (stageKey === "CONTACTED") return "CONTACTED";
  if (stageKey === "QUALIFIED") return "QUALIFIED";
  if (stageKey === "SITE_VISIT") return "SITE_VISIT_SCHEDULED";
  if (stageKey === "PROPOSAL_SENT") return "PROPOSAL_SENT";
  if (stageKey === "NEGOTIATION") return "NEGOTIATION";
  if (stageKey === "WON") return "WON";
  return "LOST";
}

export function BgosSalesCommandCenter() {
  const [range, setRange] = useState<RangePreset>("today");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<SalesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [nexaLine, setNexaLine] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/bgos/sales?range=${encodeURIComponent(range)}`);
      const j = (await res.json()) as { data?: SalesData; error?: string; message?: string };
      if (!res.ok) {
        const base = j.error ?? j.message ?? "Could not load sales.";
        setError(`${base} (HTTP ${res.status})`);
        setData(null);
      } else {
        setData(j.data ?? (j as unknown as SalesData));
      }
    } catch {
      setError("Could not load sales.");
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const openLead = useCallback(async (leadId: string) => {
    setDetailLeadId(leadId);
    setDetailBusy(true);
    setDetail(null);
    try {
      const res = await apiFetch(`/api/bgos/sales/lead/${encodeURIComponent(leadId)}`);
      const j = (await res.json()) as { data?: LeadDetail };
      setDetail(j.data ?? (j as unknown as LeadDetail));
      setNoteDraft((j.data ?? (j as unknown as LeadDetail)).lead.notes ?? "");
    } finally {
      setDetailBusy(false);
    }
  }, []);

  const patchLead = useCallback(
    async (leadId: string, payload: { status?: LeadStatus; assignedToUserId?: string | null; notes?: string }) => {
      await apiFetch(`/api/bgos/sales/lead/${encodeURIComponent(leadId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    [],
  );

  const moveLead = useCallback(
    async (leadId: string, stageKey: string) => {
      const status = nextStatusForStage(stageKey);
      await apiFetch("/api/leads/update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status }),
      });
      await load();
      if (detailLeadId === leadId) await openLead(leadId);
    },
    [detailLeadId, load, openLead],
  );

  const topPerformerId = useMemo(() => data?.team?.[0]?.userId ?? null, [data?.team]);
  const lowPerformerId = useMemo(() => data?.team?.[data.team.length - 1]?.userId ?? null, [data?.team]);
  const totalLeads = data?.metrics.totalLeads ?? 0;

  return (
    <div className={`${BGOS_MAIN_PAD} w-full pb-12 pt-5`}>
      <div className="w-full">
        <section className="sticky top-14 z-20 mb-6 rounded-2xl border border-white/10 bg-[#0B0F19]/90 px-4 py-4 backdrop-blur-md sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Sales</h1>
              <p className="mt-1 text-sm text-white/60">Manage your leads and revenue</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ViewModuleGuideButton category={UserManualCategory.SALES} />
              <button
                type="button"
                onClick={() => setAddLeadOpen(true)}
                className="rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 py-2.5 text-sm font-semibold text-[#FFE08A]"
              >
                Add Lead
              </button>
              <select
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none"
                value={range}
                onChange={(e) => setRange(e.target.value as RangePreset)}
              >
                {ranges.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total Leads", String(data?.metrics.totalLeads ?? 0)],
              ["Deals Won", String(data?.metrics.dealsWon ?? 0)],
              ["Sales Success", `${data?.metrics.conversionPercent ?? 0}%`],
              ["Revenue Generated", inr(data?.metrics.revenueGenerated ?? 0)],
            ].map(([label, value], i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.03 }}
                className={`rounded-2xl border p-4 ${
                  label === "Revenue Generated"
                    ? "border-emerald-400/30 bg-emerald-500/[0.08]"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          {busy && !data ? (
            <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
          ) : totalLeads === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
              <p className="text-lg font-medium text-white/90">No leads yet</p>
              <button
                type="button"
                onClick={() => setAddLeadOpen(true)}
                className="mt-4 rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 py-2.5 text-sm font-semibold text-[#FFE08A]"
              >
                Add your first lead
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex min-w-[1280px] gap-3">
                {data?.pipeline.map((stage) => (
                  <div
                    key={stage.key}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const leadId = e.dataTransfer.getData("text/plain");
                      if (!leadId) return;
                      await moveLead(leadId, stage.key);
                    }}
                    className="w-[300px] shrink-0 rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{stage.label}</p>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/70">
                        {stage.count}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {stage.leads.map((lead) => (
                        <button
                          key={lead.id}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            setDraggingLeadId(lead.id);
                            e.dataTransfer.setData("text/plain", lead.id);
                          }}
                          onDragEnd={() => setDraggingLeadId(null)}
                          onClick={() => void openLead(lead.id)}
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            draggingLeadId === lead.id
                              ? "border-[#FFC300]/35 bg-[#FFC300]/[0.08]"
                              : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                          }`}
                        >
                          <p className="truncate text-sm font-semibold text-white">{lead.name}</p>
                          <p className="mt-1 text-xs text-white/60">{lead.phone}</p>
                          <p className="mt-2 text-xs font-medium text-emerald-200/95">{inr(lead.value ?? 0)}</p>
                          <p className="mt-1 text-[11px] text-white/55">
                            {lead.assignee?.name ? `Assigned: ${lead.assignee.name}` : "Unassigned"}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-2">
            <h2 className="text-lg font-semibold text-white">Team Performance</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data?.team.map((member) => (
                <div
                  key={member.userId}
                  className={`rounded-xl border p-4 ${
                    member.userId === topPerformerId
                      ? "border-emerald-400/35 bg-emerald-500/[0.08]"
                      : member.userId === lowPerformerId
                        ? "border-red-400/35 bg-red-500/[0.08]"
                        : "border-white/10 bg-black/20"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{member.name}</p>
                  <p className="mt-2 text-xs text-white/70">Leads handled: {member.leadsHandled}</p>
                  <p className="text-xs text-white/70">Deals closed: {member.dealsClosed}</p>
                  <p className="text-xs text-white/70">Sales success: {member.conversionPercent}%</p>
                  <p className="mt-2 text-sm font-semibold text-white">{inr(member.revenue)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold text-white">Nexa Sales Insights</h2>
            <div className="mt-4 space-y-2">
              {data?.insights.insightLines.map((l) => (
                <p key={l} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
                  {l}
                </p>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {data?.insights.suggestionLines.map((l) => (
                <p key={l} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
                  {l}
                </p>
              ))}
            </div>
            {nexaLine ? <p className="mt-3 text-sm text-[#FFC300]/85">{nexaLine}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setNexaLine("Fix Now: start with high-value leads in Negotiation.")}
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100"
              >
                Fix Now
              </button>
              <button
                type="button"
                onClick={() => setNexaLine("Nexa will handle: automation rules will prioritize follow-ups.")}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/85"
              >
                Let Nexa Handle
              </button>
            </div>
          </div>
        </section>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>

      <BgosAddLeadModal open={addLeadOpen} onClose={() => setAddLeadOpen(false)} />

      {detailLeadId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setDetailLeadId(null)}>
          <div
            className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#0F141E] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {detailBusy || !detail ? (
              <div className="h-28 animate-pulse rounded-xl bg-white/[0.05]" />
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{detail.lead.name}</h3>
                    <p className="mt-1 text-sm text-white/60">{detail.lead.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailLeadId(null)}
                    className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs text-white/60">
                    Stage
                    <select
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.05] px-2 py-2 text-sm text-white"
                      value={detail.lead.stage}
                      onChange={async (e) => {
                        const status = e.target.value as LeadStatus;
                        setDetailSaving(true);
                        await patchLead(detail.lead.id, { status });
                        await openLead(detail.lead.id);
                        await load();
                        setDetailSaving(false);
                      }}
                    >
                      {[
                        "NEW",
                        "CONTACTED",
                        "QUALIFIED",
                        "SITE_VISIT_SCHEDULED",
                        "SITE_VISIT_COMPLETED",
                        "PROPOSAL_SENT",
                        "NEGOTIATION",
                        "PROPOSAL_WON",
                        "WON",
                        "LOST",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-white/60">
                    Assigned employee
                    <select
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.05] px-2 py-2 text-sm text-white"
                      value={detail.lead.assignedToUserId ?? ""}
                      onChange={async (e) => {
                        const picked = e.target.value;
                        const mine = detail.lead.createdByUserId ?? data?.currentUserId ?? null;
                        const assignedToUserId = picked === "__MY__" ? mine : picked || null;
                        setDetailSaving(true);
                        await patchLead(detail.lead.id, { assignedToUserId });
                        await openLead(detail.lead.id);
                        await load();
                        setDetailSaving(false);
                      }}
                    >
                      <option value="">Unassigned</option>
                      <option value="__MY__">My Lead (Boss)</option>
                      {data?.employees
                        .filter((u) => u.id !== (detail.lead.createdByUserId ?? data.currentUserId))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4">
                  <p className="text-xs text-white/60">Notes</p>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={5}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none"
                  />
                  <button
                    type="button"
                    disabled={detailSaving}
                    onClick={async () => {
                      setDetailSaving(true);
                      await patchLead(detail.lead.id, { notes: noteDraft });
                      await openLead(detail.lead.id);
                      setDetailSaving(false);
                    }}
                    className="mt-2 rounded-lg border border-[#FFC300]/30 bg-[#FFC300]/10 px-3 py-1.5 text-xs font-semibold text-[#FFE08A]"
                  >
                    Save note
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/bgos/money/quotation/create?leadId=${encodeURIComponent(detail.lead.id)}`}
                    className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/90"
                  >
                    Create Quotation
                  </Link>
                  <Link
                    href={`/bgos/money/invoices?leadId=${encodeURIComponent(detail.lead.id)}`}
                    className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/90"
                  >
                    Generate Invoice
                  </Link>
                </div>

                <div className="mt-5">
                  <p className="text-xs text-white/60">Activity log</p>
                  <div className="mt-2 space-y-2">
                    {detail.activity.length === 0 ? (
                      <p className="text-sm text-white/45">No activity yet.</p>
                    ) : (
                      detail.activity.map((a) => (
                        <div key={a.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <p className="text-sm text-white/80">{a.message}</p>
                          <p className="mt-1 text-[11px] text-white/45">
                            {a.user?.name ?? "System"} · {formatDate(a.createdAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
