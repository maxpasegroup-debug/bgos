"use client";


import { apiFetch } from "@/lib/api-fetch";
import { UserManualCategory } from "@prisma/client";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { ViewModuleGuideButton } from "@/components/bgos/ViewModuleGuideButton";

type RangePreset = "today" | "this_week" | "this_month";
type WorkflowStage =
  | "SITE_VISIT_SCHEDULED"
  | "SITE_VISIT_COMPLETED"
  | "APPROVAL"
  | "INSTALLATION_SCHEDULED"
  | "INSTALLATION_IN_PROGRESS"
  | "COMPLETED";
type CardSource = "site_visit" | "approval" | "installation";

type WorkflowCard = {
  id: string;
  stage: WorkflowStage;
  source: CardSource;
  sourceId: string;
  customerName: string;
  location: string;
  assignedToUserId: string | null;
  assignedEmployee: string;
  status: string;
  leadId: string | null;
  scheduledDate: string | null;
  notes: string | null;
};

type OpsData = {
  metrics: {
    pendingSiteVisits: number;
    pendingApprovals: number;
    installationsInProgress: number;
    completedJobs: number;
  };
  workflow: { stage: WorkflowStage; count: number; cards: WorkflowCard[] }[];
  team: {
    userId: string;
    name: string;
    jobsAssigned: number;
    jobsCompleted: number;
    delays: number;
  }[];
  insights: {
    insightLines: string[];
    suggestionLines: string[];
  };
  serviceTickets: {
    id: string;
    customer: string;
    leadId: string | null;
    issue: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    status: "OPEN" | "IN_PROGRESS" | "CLOSED";
    assignedToUserId: string | null;
    assignedEmployee: string;
  }[];
  employees: { id: string; name: string }[];
  leads: { id: string; name: string; location: string }[];
};

const labels: Record<WorkflowStage, string> = {
  SITE_VISIT_SCHEDULED: "Site Visit Scheduled",
  SITE_VISIT_COMPLETED: "Site Visit Completed",
  APPROVAL: "Approval (KSEB / PRO)",
  INSTALLATION_SCHEDULED: "Installation Scheduled",
  INSTALLATION_IN_PROGRESS: "Installation In Progress",
  COMPLETED: "Completed",
};

function mapRangeToApi(r: RangePreset): string {
  if (r === "today") return "today";
  if (r === "this_week") return "this_week";
  return "this_month";
}

function prettyDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function BgosOperationsCommandCenter() {
  const [range, setRange] = useState<RangePreset>("today");
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [siteOpen, setSiteOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [nexaLine, setNexaLine] = useState<string | null>(null);

  const [siteForm, setSiteForm] = useState({ leadId: "", date: "", assignEngineerUserId: "" });
  const [serviceForm, setServiceForm] = useState({
    leadId: "",
    issue: "",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH",
    assignedToUserId: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/bgos/operations?range=${encodeURIComponent(mapRangeToApi(range))}`, {
        credentials: "include",
      });
      const j = (await res.json()) as { data?: OpsData; message?: string; error?: string };
      if (!res.ok) {
        setError(j.message ?? j.error ?? "Could not load operations.");
        setData(null);
      } else {
        setData(j.data ?? (j as unknown as OpsData));
      }
    } catch {
      setError("Could not load operations.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDropStage = useCallback(
    async (card: WorkflowCard, stage: WorkflowStage) => {
      await apiFetch("/api/operations/update-status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: card.source,
          sourceId: card.sourceId,
          targetStage: stage,
        }),
      });
      await load();
    },
    [load],
  );

  const totalWorkflow = useMemo(
    () => (data?.workflow ?? []).reduce((sum, s) => sum + s.count, 0),
    [data?.workflow],
  );

  async function scheduleSiteVisit() {
    await apiFetch("/api/bgos/operations/site-visit", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(siteForm),
    });
    setSiteOpen(false);
    setSiteForm({ leadId: "", date: "", assignEngineerUserId: "" });
    await load();
  }

  async function createServiceRequest() {
    await apiFetch("/api/bgos/operations/service-request", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...serviceForm,
        assignedToUserId: serviceForm.assignedToUserId || undefined,
      }),
    });
    setServiceOpen(false);
    setServiceForm({ leadId: "", issue: "", priority: "MEDIUM", assignedToUserId: "" });
    await load();
  }

  return (
    <div className={`${BGOS_MAIN_PAD} w-full pb-12 pt-5`}>
      <div className="w-full">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Operations</h1>
              <p className="mt-1 text-sm text-white/60">Track execution and delivery</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ViewModuleGuideButton category={UserManualCategory.OPERATIONS} />
              <button
                type="button"
                onClick={() => setSiteOpen(true)}
                className="rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 py-2.5 text-sm font-semibold text-[#FFE08A]"
              >
                Schedule Site Visit
              </button>
              <select
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white"
                value={range}
                onChange={(e) => setRange(e.target.value as RangePreset)}
              >
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
              </select>
            </div>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Pending site visits", String(data?.metrics.pendingSiteVisits ?? 0)],
            ["Pending approvals", String(data?.metrics.pendingApprovals ?? 0)],
            ["Installations in progress", String(data?.metrics.installationsInProgress ?? 0)],
            ["Completed jobs", String(data?.metrics.completedJobs ?? 0)],
          ].map(([label, value], i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
            </motion.div>
          ))}
        </section>

        <section className="mb-8">
          {loading && !data ? (
            <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
          ) : totalWorkflow === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
              <p className="text-lg font-medium text-white/90">No operations yet</p>
              <button
                type="button"
                onClick={() => setSiteOpen(true)}
                className="mt-4 rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 py-2.5 text-sm font-semibold text-[#FFE08A]"
              >
                Schedule first site visit
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex min-w-[1320px] gap-3">
                {data?.workflow.map((col) => (
                  <div
                    key={col.stage}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const raw = e.dataTransfer.getData("application/json");
                      if (!raw) return;
                      const card = JSON.parse(raw) as WorkflowCard;
                      await onDropStage(card, col.stage);
                    }}
                    className="w-[310px] shrink-0 rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{labels[col.stage]}</p>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/70">
                        {col.count}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {col.cards.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            setDragLeadId(card.id);
                            e.dataTransfer.setData("application/json", JSON.stringify(card));
                          }}
                          onDragEnd={() => setDragLeadId(null)}
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            dragLeadId === card.id
                              ? "border-[#FFC300]/35 bg-[#FFC300]/[0.08]"
                              : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                          }`}
                        >
                          <p className="truncate text-sm font-semibold text-white">{card.customerName}</p>
                          <p className="mt-1 text-xs text-white/60">Location: {card.location || "—"}</p>
                          <p className="mt-1 text-xs text-white/60">Assigned: {card.assignedEmployee}</p>
                          <p className="mt-1 text-xs text-white/60">Status: {card.status}</p>
                          <p className="mt-1 text-[11px] text-white/45">Date: {prettyDate(card.scheduledDate)}</p>

                          {card.source === "site_visit" && card.stage === "SITE_VISIT_SCHEDULED" ? (
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const report = window.prompt("Add site visit report (optional):", card.notes ?? "");
                                  await apiFetch("/api/operations/update-status", {
                                    method: "PATCH",
                                    credentials: "include",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      source: card.source,
                                      sourceId: card.sourceId,
                                      targetStage: "SITE_VISIT_COMPLETED",
                                      ...(report !== null ? { notes: report } : {}),
                                    }),
                                  });
                                  await load();
                                }}
                                className="rounded-md border border-emerald-400/35 px-2 py-1 text-[11px] text-emerald-200"
                              >
                                Mark Completed
                              </button>
                            </div>
                          ) : null}

                          {card.source === "approval" ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const note = window.prompt("Approval notes (optional):", card.notes ?? "");
                                    await apiFetch("/api/operations/update-status", {
                                      method: "PATCH",
                                      credentials: "include",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        source: card.source,
                                        sourceId: card.sourceId,
                                        targetStage: s === "APPROVED" ? "INSTALLATION_SCHEDULED" : "APPROVAL",
                                        approvalStatus: s,
                                        ...(note !== null ? { notes: note } : {}),
                                      }),
                                    });
                                    await load();
                                  }}
                                  className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/80"
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {card.source === "installation" ? (
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await apiFetch("/api/operations/update-status", {
                                    method: "PATCH",
                                    credentials: "include",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      source: card.source,
                                      sourceId: card.sourceId,
                                      targetStage: "INSTALLATION_IN_PROGRESS",
                                    }),
                                  });
                                  await load();
                                }}
                                className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/80"
                              >
                                Start
                              </button>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await apiFetch("/api/operations/update-status", {
                                    method: "PATCH",
                                    credentials: "include",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      source: card.source,
                                      sourceId: card.sourceId,
                                      targetStage: "COMPLETED",
                                    }),
                                  });
                                  await load();
                                }}
                                className="rounded-md border border-emerald-400/35 px-2 py-1 text-[11px] text-emerald-200"
                              >
                                Complete
                              </button>
                            </div>
                          ) : null}
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
            <h2 className="text-lg font-semibold text-white">Operations team performance</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data?.team.map((t, idx) => (
                <div
                  key={t.userId}
                  className={`rounded-xl border p-4 ${
                    idx === 0
                      ? "border-emerald-400/35 bg-emerald-500/[0.08]"
                      : t.delays > 0
                        ? "border-red-400/35 bg-red-500/[0.08]"
                        : "border-white/10 bg-black/20"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="mt-2 text-xs text-white/70">Jobs assigned: {t.jobsAssigned}</p>
                  <p className="text-xs text-white/70">Jobs completed: {t.jobsCompleted}</p>
                  <p className="text-xs text-white/70">Delays: {t.delays}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold text-white">Nexa Operations Insights</h2>
            <div className="mt-4 space-y-2">
              {data?.insights.insightLines.map((line) => (
                <p key={line} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
                  {line}
                </p>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {data?.insights.suggestionLines.map((line) => (
                <p key={line} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
                  {line}
                </p>
              ))}
            </div>
            {nexaLine ? <p className="mt-3 text-sm text-[#FFC300]/85">{nexaLine}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setNexaLine("Fix Now: assign extra technician to delayed installations.")}
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100"
              >
                Fix Now
              </button>
              <button
                type="button"
                onClick={() => setNexaLine("Auto Handle: Nexa will keep prompting pending approvals.")}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/85"
              >
                Auto Handle
              </button>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">Service system</h2>
            <button
              type="button"
              onClick={() => setServiceOpen(true)}
              className="rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 py-2 text-sm font-semibold text-[#FFE08A]"
            >
              Create Service Request
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/50">
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Issue</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {(data?.serviceTickets ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-white/5 text-white/80">
                    <td className="px-3 py-2">{t.customer}</td>
                    <td className="px-3 py-2">{t.issue}</td>
                    <td className="px-3 py-2">{t.priority}</td>
                    <td className="px-3 py-2">
                      <select
                        value={t.status}
                        onChange={async (e) => {
                          const next = e.target.value as "OPEN" | "IN_PROGRESS" | "CLOSED";
                          await apiFetch("/api/operations/update-status", {
                            method: "PATCH",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              source: "service_ticket",
                              sourceId: t.id,
                              targetStage:
                                next === "OPEN"
                                  ? "SERVICE_OPEN"
                                  : next === "IN_PROGRESS"
                                    ? "SERVICE_IN_PROGRESS"
                                    : "SERVICE_CLOSED",
                            }),
                          });
                          await load();
                        }}
                        className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white"
                      >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">{t.assignedEmployee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>

      {siteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F141E] p-5">
            <h3 className="text-lg font-semibold text-white">Schedule Site Visit</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-white/60">
                Lead / Customer
                <select
                  value={siteForm.leadId}
                  onChange={(e) => setSiteForm((s) => ({ ...s, leadId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select</option>
                  {data?.leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-white/60">
                Date
                <input
                  type="date"
                  value={siteForm.date}
                  onChange={(e) => setSiteForm((s) => ({ ...s, date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/60">
                Assign Engineer
                <select
                  value={siteForm.assignEngineerUserId}
                  onChange={(e) => setSiteForm((s) => ({ ...s, assignEngineerUserId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select</option>
                  {data?.employees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSiteOpen(false)}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void scheduleSiteVisit()}
                className="rounded-lg border border-[#FFC300]/35 bg-[#FFC300]/10 px-3 py-2 text-sm font-semibold text-[#FFE08A]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {serviceOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F141E] p-5">
            <h3 className="text-lg font-semibold text-white">Create Service Request</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-white/60">
                Customer
                <select
                  value={serviceForm.leadId}
                  onChange={(e) => setServiceForm((s) => ({ ...s, leadId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select</option>
                  {data?.leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-white/60">
                Issue
                <textarea
                  rows={3}
                  value={serviceForm.issue}
                  onChange={(e) => setServiceForm((s) => ({ ...s, issue: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/60">
                Priority
                <select
                  value={serviceForm.priority}
                  onChange={(e) =>
                    setServiceForm((s) => ({
                      ...s,
                      priority: e.target.value as "LOW" | "MEDIUM" | "HIGH",
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setServiceOpen(false)}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createServiceRequest()}
                className="rounded-lg border border-[#FFC300]/35 bg-[#FFC300]/10 px-3 py-2 text-sm font-semibold text-[#FFE08A]"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
