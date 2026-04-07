"use client";

import { LeadStatus, UserRole } from "@prisma/client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import {
  forwardLeadStatuses,
  LEAD_PIPELINE_ORDER,
  leadStatusLabel,
} from "@/lib/lead-pipeline";
import { useBgosDashboardContext } from "./BgosDataProvider";
import { fadeUp } from "./motion";

type PipelineLeadCard = {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  statusLabel: string;
  value: number | null;
  assignedTo: string | null;
  assignee: { id: string; name: string; email: string } | null;
};

type PipelineStageColumn = {
  status: LeadStatus;
  label: string;
  count: number;
  leads: PipelineLeadCard[];
};

type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function emptyBoard(): PipelineStageColumn[] {
  return LEAD_PIPELINE_ORDER.map((status) => ({
    status,
    label: leadStatusLabel(status),
    count: 0,
    leads: [],
  }));
}

function parseLead(raw: unknown, fallbackStatus: LeadStatus): PipelineLeadCard | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Record<string, unknown>;
  if (typeof l.id !== "string" || typeof l.name !== "string" || typeof l.phone !== "string") {
    return null;
  }
  const status =
    typeof l.status === "string" && LEAD_PIPELINE_ORDER.includes(l.status as LeadStatus)
      ? (l.status as LeadStatus)
      : fallbackStatus;
  const assignee =
    l.assignee && typeof l.assignee === "object"
      ? (() => {
          const a = l.assignee as Record<string, unknown>;
          if (typeof a.id !== "string" || typeof a.name !== "string" || typeof a.email !== "string") {
            return null;
          }
          return { id: a.id, name: a.name, email: a.email };
        })()
      : null;
  return {
    id: l.id,
    name: l.name,
    phone: l.phone,
    status,
    statusLabel:
      typeof l.statusLabel === "string" ? l.statusLabel : leadStatusLabel(status),
    value: typeof l.value === "number" && Number.isFinite(l.value) ? l.value : null,
    assignedTo: typeof l.assignedTo === "string" ? l.assignedTo : null,
    assignee,
  };
}

function parsePipelinePayload(json: unknown): PipelineStageColumn[] | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.ok !== true || !Array.isArray(o.stages)) return null;
  const out: PipelineStageColumn[] = [];
  for (const colRaw of o.stages) {
    if (!colRaw || typeof colRaw !== "object") continue;
    const c = colRaw as Record<string, unknown>;
    const statusStr = c.status;
    if (typeof statusStr !== "string" || !LEAD_PIPELINE_ORDER.includes(statusStr as LeadStatus)) {
      continue;
    }
    const status = statusStr as LeadStatus;
    const label =
      typeof c.label === "string" && c.label.trim() ? c.label : leadStatusLabel(status);
    const count =
      typeof c.count === "number" && Number.isFinite(c.count) && c.count >= 0 ? c.count : 0;
    const leadsIn: PipelineLeadCard[] = [];
    if (Array.isArray(c.leads)) {
      for (const lr of c.leads) {
        const parsed = parseLead(lr, status);
        if (parsed) leadsIn.push(parsed);
      }
    }
    out.push({ status, label, count, leads: leadsIn });
  }
  return out.length > 0 ? out : null;
}

function moveLeadInBoard(
  stages: PipelineStageColumn[],
  leadId: string,
  from: LeadStatus,
  to: LeadStatus,
  patch?: Partial<PipelineLeadCard>,
): PipelineStageColumn[] {
  const fromCol = stages.find((c) => c.status === from);
  const found = fromCol?.leads.find((l) => l.id === leadId);
  if (!found) return stages;

  const base: PipelineLeadCard = { ...found, ...patch };
  const next: PipelineLeadCard = {
    ...base,
    status: to,
    statusLabel: leadStatusLabel(to),
  };

  const stripped = stages.map((col) => {
    if (col.status !== from) return col;
    return {
      ...col,
      leads: col.leads.filter((l) => l.id !== leadId),
      count: Math.max(0, col.count - 1),
    };
  });

  return stripped.map((col) => {
    if (col.status !== to) return col;
    if (col.leads.some((l) => l.id === leadId)) return col;
    return { ...col, leads: [next, ...col.leads], count: col.count + 1 };
  });
}

function patchAssigneeInBoard(
  stages: PipelineStageColumn[],
  leadId: string,
  assignedTo: string | null,
  assignee: PipelineLeadCard["assignee"],
): PipelineStageColumn[] {
  return stages.map((col) => ({
    ...col,
    leads: col.leads.map((l) =>
      l.id === leadId ? { ...l, assignedTo, assignee } : l,
    ),
  }));
}

const cardSelectClass =
  "w-full rounded-md border border-white/10 bg-black/45 px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#FFC300]/40 disabled:opacity-50";

export function BgosPipelineBoard() {
  const { refetch: refetchDashboard, sessionRole, syncGeneration } = useBgosDashboardContext();
  const isAdmin = sessionRole === UserRole.ADMIN;
  const canMoney = sessionRole === UserRole.ADMIN || sessionRole === UserRole.MANAGER;

  const [stages, setStages] = useState<PipelineStageColumn[]>(() => emptyBoard());
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [quotationTipByLead, setQuotationTipByLead] = useState<
    Record<string, { id: string; status: string; quotationNumber: string }>
  >({});
  const [invoiceTipByLead, setInvoiceTipByLead] = useState<
    Record<string, { id: string; paymentBucket: string; invoiceNumber: string }>
  >({});
  const pipelineInitialLoad = useRef(true);

  const loadPipeline = useCallback(async () => {
    setBanner(null);
    try {
      const res = await fetch("/api/leads/pipeline", { credentials: "include" });
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        setStages(emptyBoard());
        setBanner("Could not read pipeline data.");
        return;
      }
      const parsed = parsePipelinePayload(json);
      if (!res.ok || !parsed) {
        setStages(emptyBoard());
        const msg =
          json && typeof json === "object" && typeof (json as { error?: string }).error === "string"
            ? (json as { error: string }).error
            : "Pipeline could not be loaded.";
        setBanner(msg);
        return;
      }
      setStages(parsed);
    } catch {
      setStages(emptyBoard());
      setBanner("Network error — check your connection.");
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      setUsers([]);
      return;
    }
    try {
      const res = await fetch("/api/users", { credentials: "include" });
      const data = (await res.json()) as { ok?: boolean; users?: PublicUser[] };
      if (res.ok && Array.isArray(data.users)) {
        setUsers(data.users.filter((u) => u.isActive));
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    }
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    if (pipelineInitialLoad.current) {
      setLoading(true);
    }
    void (async () => {
      await Promise.all([loadPipeline(), loadUsers()]);
      pipelineInitialLoad.current = false;
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPipeline, loadUsers, syncGeneration]);

  useEffect(() => {
    if (!canMoney) {
      setQuotationTipByLead({});
      setInvoiceTipByLead({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [qRes, iRes] = await Promise.all([
          fetch("/api/quotation/list", { credentials: "include" }),
          fetch("/api/invoice/list", { credentials: "include" }),
        ]);
        const qData = (await qRes.json()) as {
          ok?: boolean;
          quotations?: { id: string; leadId: string | null; status: string; quotationNumber: string }[];
        };
        const iData = (await iRes.json()) as {
          ok?: boolean;
          invoices?: {
            id: string;
            leadId: string | null;
            paymentBucket: string;
            invoiceNumber: string;
          }[];
        };
        if (cancelled) return;
        if (!qRes.ok || !qData.ok || !Array.isArray(qData.quotations)) {
          setQuotationTipByLead({});
        } else {
          const qt: Record<string, { id: string; status: string; quotationNumber: string }> = {};
          for (const q of qData.quotations) {
            if (q.leadId && !qt[q.leadId]) {
              qt[q.leadId] = { id: q.id, status: q.status, quotationNumber: q.quotationNumber };
            }
          }
          setQuotationTipByLead(qt);
        }
        if (!iRes.ok || !iData.ok || !Array.isArray(iData.invoices)) {
          setInvoiceTipByLead({});
        } else {
          const inv: Record<string, { id: string; paymentBucket: string; invoiceNumber: string }> =
            {};
          for (const invRow of iData.invoices) {
            if (invRow.leadId && !inv[invRow.leadId]) {
              inv[invRow.leadId] = {
                id: invRow.id,
                paymentBucket: invRow.paymentBucket,
                invoiceNumber: invRow.invoiceNumber,
              };
            }
          }
          setInvoiceTipByLead(inv);
        }
      } catch {
        if (!cancelled) {
          setQuotationTipByLead({});
          setInvoiceTipByLead({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canMoney, syncGeneration]);

  async function patchLead(body: {
    leadId: string;
    status?: LeadStatus;
    assignedToUserId?: string | null;
  }) {
    const res = await fetch("/api/leads/update-status", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data: { ok?: boolean; lead?: unknown; error?: string } = {};
    try {
      data = (await res.json()) as typeof data;
    } catch {
      /* ignore */
    }
    return { res, data };
  }

  async function onStageAdvance(lead: PipelineLeadCard, to: LeadStatus) {
    if (to === lead.status) return;
    const prev = stages;
    setBusyLeadId(lead.id);
    setStages((s) => moveLeadInBoard(s, lead.id, lead.status, to));
    try {
      const { res, data } = await patchLead({ leadId: lead.id, status: to });
      if (!res.ok || !data.ok) {
        setStages(prev);
        setBanner(
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : "Could not update stage.",
        );
        window.setTimeout(() => setBanner(null), 6000);
        return;
      }
      if (data.lead) {
        const normalized = parseLead(data.lead, to);
        if (normalized) {
          setStages((s) =>
            s.map((col) => ({
              ...col,
              leads: col.leads.map((l) => (l.id === lead.id ? normalized : l)),
            })),
          );
        }
      }
      void refetchDashboard();
    } catch {
      setStages(prev);
      setBanner("Network error — stage reverted.");
      window.setTimeout(() => setBanner(null), 6000);
    } finally {
      setBusyLeadId(null);
    }
  }

  async function onAssignChange(lead: PipelineLeadCard, raw: string) {
    if (!isAdmin) return;
    const assignedToUserId = raw === "" ? null : raw;
    if (assignedToUserId === lead.assignedTo) return;

    const picked =
      assignedToUserId === null
        ? null
        : users.find((u) => u.id === assignedToUserId) ?? lead.assignee;

    const optimisticAssignee =
      assignedToUserId === null
        ? null
        : picked
          ? { id: picked.id, name: picked.name, email: picked.email }
          : null;

    const prev = stages;
    setBusyLeadId(lead.id);
    setStages((s) =>
      patchAssigneeInBoard(s, lead.id, assignedToUserId, optimisticAssignee),
    );

    try {
      const { res, data } = await patchLead({ leadId: lead.id, assignedToUserId });
      if (!res.ok || !data.ok) {
        setStages(prev);
        setBanner(
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : "Could not update assignment.",
        );
        window.setTimeout(() => setBanner(null), 6000);
        return;
      }
      if (data.lead) {
        const normalized = parseLead(data.lead, lead.status);
        if (normalized) {
          setStages((s) =>
            patchAssigneeInBoard(
              s,
              lead.id,
              normalized.assignedTo,
              normalized.assignee,
            ),
          );
        }
      }
      void refetchDashboard();
    } catch {
      setStages(prev);
      setBanner("Network error — assignment reverted.");
      window.setTimeout(() => setBanner(null), 6000);
    } finally {
      setBusyLeadId(null);
    }
  }

  const nextOptions = (lead: PipelineLeadCard) => forwardLeadStatuses(lead.status);

  return (
    <motion.section
      id="sales"
      variants={fadeUp}
      className="col-span-full"
      style={{ scrollMarginTop: "5.5rem" }}
    >
      <DashboardSurface tilt={false} className="p-4 sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white sm:text-base">Sales pipeline</h2>
            <p className="mt-0.5 text-xs text-white/45">
              Kanban from live data — advance stages or assign owners (admins only).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadPipeline()}
            className="mt-2 shrink-0 self-start rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-[#FFC300]/35 hover:text-white sm:mt-0"
          >
            Refresh
          </button>
        </div>

        {banner ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100/90" role="status">
            {banner}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-4 flex gap-3 overflow-hidden pb-2">
            {LEAD_PIPELINE_ORDER.slice(0, 5).map((s) => (
              <div
                key={s}
                className="h-48 min-w-[13rem] flex-1 animate-pulse rounded-xl bg-white/[0.06]"
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]">
            {stages.map((col) => (
              <div
                key={col.status}
                className="flex w-[min(100%,18rem)] shrink-0 flex-col sm:w-[17rem]"
              >
                <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                    {col.label}
                  </h3>
                  <span className="tabular-nums text-[11px] font-medium text-white/40">
                    {col.count}
                  </span>
                </div>
                <div className="flex max-h-[min(70vh,42rem)] flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2">
                  {col.leads.length === 0 ? (
                    <p className="px-1 py-6 text-center text-[11px] text-white/30">
                      No leads
                      {col.status === LeadStatus.PROPOSAL_SENT ? (
                        <span className="mt-2 block text-[10px] text-white/25">
                          Start by creating a quotation for your lead.
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    col.leads.map((lead) => (
                      <article
                        key={lead.id}
                        className="rounded-lg border border-white/10 bg-white/[0.05] p-3 shadow-sm"
                      >
                        <Link
                          href={`/bgos/leads/${encodeURIComponent(lead.id)}`}
                          className="font-medium leading-snug text-white transition hover:text-[#FFC300]"
                        >
                          {lead.name}
                        </Link>
                        <p className="mt-1 text-[11px] text-white/55">{lead.phone}</p>
                        <p className="mt-1 text-xs font-medium tabular-nums text-[#FFC300]/90">
                          {lead.value != null && lead.value > 0
                            ? formatInr(lead.value)
                            : "—"}
                        </p>

                        {canMoney &&
                        (lead.status === LeadStatus.PROPOSAL_SENT || lead.status === LeadStatus.NEGOTIATION) &&
                        !(quotationTipByLead[lead.id] && quotationTipByLead[lead.id].status !== "REJECTED") ? (
                          <Link
                            href={`/bgos/money/quotation/create?leadId=${encodeURIComponent(lead.id)}`}
                            className="mt-2 inline-flex min-h-[36px] items-center justify-center rounded-lg border border-[#FFC300]/40 bg-[#FFC300]/10 px-2.5 text-[11px] font-semibold text-[#FFC300] transition hover:bg-[#FFC300]/18"
                          >
                            Create quote
                          </Link>
                        ) : null}

                        {canMoney &&
                        quotationTipByLead[lead.id] &&
                        quotationTipByLead[lead.id].status !== "REJECTED" ? (
                          <p className="mt-2 text-[10px] text-white/50">
                            Quote {quotationTipByLead[lead.id].quotationNumber} ·{" "}
                            <span className="text-[#FFC300]/85">{quotationTipByLead[lead.id].status}</span>
                          </p>
                        ) : null}

                        {canMoney &&
                        quotationTipByLead[lead.id]?.status === "APPROVED" &&
                        !invoiceTipByLead[lead.id] ? (
                          <Link
                            href={`/bgos/money/invoices?quotationId=${encodeURIComponent(quotationTipByLead[lead.id].id)}`}
                            className="mt-2 inline-flex min-h-[36px] items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 text-[11px] font-semibold text-emerald-200/95 transition hover:bg-emerald-500/15"
                          >
                            Generate invoice
                          </Link>
                        ) : null}

                        {canMoney && invoiceTipByLead[lead.id] ? (
                          <div className="mt-2 space-y-1 rounded-lg border border-white/10 bg-black/20 px-2 py-2">
                            <p className="text-[10px] text-white/50">
                              Invoice ·{" "}
                              <span className="font-medium text-white/80">
                                {invoiceTipByLead[lead.id].invoiceNumber}
                              </span>{" "}
                              ({invoiceTipByLead[lead.id].paymentBucket})
                            </p>
                            <Link
                              href={`/bgos/money/invoices/${invoiceTipByLead[lead.id].id}`}
                              className="inline-flex text-[11px] font-semibold text-emerald-200/90 hover:text-emerald-100"
                            >
                              View invoice →
                            </Link>
                          </div>
                        ) : null}

                        <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
                          <div>
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
                              Stage
                            </span>
                            {nextOptions(lead).length === 0 ? (
                              <p className="mt-0.5 text-[11px] text-white/45">Closed</p>
                            ) : (
                              <select
                                key={`${lead.id}-${lead.status}-stage`}
                                defaultValue=""
                                disabled={busyLeadId === lead.id}
                                className={`${cardSelectClass} mt-0.5`}
                                aria-label={`Move ${lead.name} to stage`}
                                onChange={(e) => {
                                  const v = e.target.value as LeadStatus;
                                  e.target.value = "";
                                  if (v) void onStageAdvance(lead, v);
                                }}
                              >
                                <option value="" disabled>
                                  Advance…
                                </option>
                                {nextOptions(lead).map((st) => (
                                  <option key={st} value={st}>
                                    {leadStatusLabel(st)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div>
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
                              Assign to
                            </span>
                            {isAdmin ? (
                              <select
                                key={`${lead.id}-${lead.assignedTo ?? "u"}-as`}
                                value={lead.assignedTo ?? ""}
                                disabled={busyLeadId === lead.id}
                                className={`${cardSelectClass} mt-0.5`}
                                aria-label={`Assign ${lead.name}`}
                                onChange={(e) => void onAssignChange(lead, e.target.value)}
                              >
                                <option value="">Unassigned</option>
                                {users.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="mt-0.5 text-[11px] text-white/50">
                                {lead.assignee?.name ?? "—"}
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardSurface>
    </motion.section>
  );
}
