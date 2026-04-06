"use client";

import { LeadStatus, TaskStatus } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { forwardLeadStatuses, leadStatusLabel } from "@/lib/lead-pipeline";
import { IceconnectWorkspaceView } from "./IceconnectWorkspaceView";
import { IcPanel } from "./IcPanel";

type LeadRow = {
  id: string;
  name: string;
  status: LeadStatus;
  statusLabel: string;
  phone: string;
  value: number | null;
};

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  overdue: boolean;
  dueDate: string | null;
  lead: { id: string; name: string } | null;
};

type SalesStats = {
  leadCount: number;
  pendingTaskCount: number;
  overdueTaskCount: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatIceApiError(json: unknown, fallback: string): string {
  if (!isRecord(json)) return fallback;
  const err = json.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (isRecord(err) && typeof err.formErrors === "object") {
    const fe = err.formErrors;
    if (Array.isArray(fe) && fe.length > 0 && typeof fe[0] === "string") return fe[0];
  }
  const code = json.code;
  if (typeof code === "string" && code.trim()) return `${fallback} (${code})`;
  return fallback;
}

function normalizeLead(raw: unknown): LeadRow | null {
  if (!isRecord(raw)) return null;
  const id = raw.id;
  const name = raw.name;
  const status = raw.status;
  if (typeof id !== "string" || !id || typeof name !== "string" || typeof status !== "string") {
    return null;
  }
  if (!(status in LeadStatus)) return null;
  const phone = typeof raw.phone === "string" ? raw.phone : "—";
  const statusLabel =
    typeof raw.statusLabel === "string" && raw.statusLabel.trim()
      ? raw.statusLabel
      : leadStatusLabel(status as LeadStatus);
  const value =
    typeof raw.value === "number" && Number.isFinite(raw.value)
      ? raw.value
      : raw.value === null
        ? null
        : null;
  return {
    id,
    name,
    status: status as LeadStatus,
    statusLabel,
    phone,
    value,
  };
}

function normalizeTask(raw: unknown): TaskRow | null {
  if (!isRecord(raw)) return null;
  const id = raw.id;
  const title = raw.title;
  const status = raw.status;
  if (typeof id !== "string" || !id || typeof title !== "string" || typeof status !== "string") {
    return null;
  }
  if (!(status in TaskStatus)) return null;
  let lead: { id: string; name: string } | null = null;
  const lr = raw.lead;
  if (isRecord(lr) && typeof lr.id === "string" && typeof lr.name === "string") {
    lead = { id: lr.id, name: lr.name };
  }
  const dueDate = typeof raw.dueDate === "string" ? raw.dueDate : null;
  const overdue = raw.overdue === true;
  return {
    id,
    title,
    status: status as TaskStatus,
    overdue,
    dueDate,
    lead,
  };
}

function formatDueLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const day = d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const t = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (d < now) return `Due ${day}, ${t}`;
  return `${day}, ${t}`;
}

export function IceconnectSalesDashboard() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/iceconnect/sales/data", { credentials: "include" });
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        setErr(res.ok ? "Invalid response from server." : "Could not load your workspace.");
        return;
      }

      if (!res.ok) {
        setErr(formatIceApiError(json, res.status === 401 ? "Session expired — sign in again." : "Could not load your workspace."));
        return;
      }

      if (!isRecord(json) || json.ok !== true) {
        setErr(formatIceApiError(json, "Could not load your workspace."));
        return;
      }

      const rawLeads = Array.isArray(json.leads) ? json.leads : [];
      const rawTasks = Array.isArray(json.tasks) ? json.tasks : [];
      setLeads(rawLeads.map(normalizeLead).filter(Boolean) as LeadRow[]);
      setTasks(rawTasks.map(normalizeTask).filter(Boolean) as TaskRow[]);

      const st = json.stats;
      if (
        isRecord(st) &&
        typeof st.leadCount === "number" &&
        typeof st.pendingTaskCount === "number" &&
        typeof st.overdueTaskCount === "number"
      ) {
        setStats({
          leadCount: st.leadCount,
          pendingTaskCount: st.pendingTaskCount,
          overdueTaskCount: st.overdueTaskCount,
        });
      } else {
        setStats(null);
      }
    } catch {
      setErr("Network error — check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { followUps, generalTasks } = useMemo(() => {
    const pending = tasks.filter((t) => t.status === TaskStatus.PENDING);
    const followUps = pending.filter((t) => t.dueDate != null && t.dueDate !== "");
    const generalTasks = pending.filter((t) => t.dueDate == null || t.dueDate === "");
    followUps.sort((a, b) => {
      const ta = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const tb = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return ta - tb;
    });
    return { followUps, generalTasks };
  }, [tasks]);

  async function updateStatus(leadId: string, status: LeadStatus) {
    setBusy(leadId);
    setErr(null);
    try {
      const res = await fetch("/api/iceconnect/sales/lead-status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status }),
      });
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        setErr("Update failed — invalid response.");
        return;
      }
      if (!res.ok) {
        setErr(formatIceApiError(json, "Could not update lead status."));
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function completeTask(taskId: string) {
    setBusy(taskId);
    setErr(null);
    try {
      const res = await fetch("/api/tasks/complete", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        setErr("Could not complete task — invalid response.");
        return;
      }
      if (!res.ok) {
        setErr(formatIceApiError(json, "Could not complete task."));
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <IceconnectWorkspaceView
      title="Sales"
      subtitle="Leads assigned to you, tasks, and scheduled follow-ups."
      loading={loading}
      error={err}
      onRetry={() => void load()}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="min-h-11 min-w-[5.5rem] rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-white/45">Your leads</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{stats.leadCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-white/45">Pending tasks</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {stats.pendingTaskCount}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-white/45">Overdue</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-200">
              {stats.overdueTaskCount}
            </p>
          </div>
        </div>
      ) : null}

      <IcPanel title="Assigned leads">
        {leads.length === 0 ? (
          <p className="text-sm text-white/45">No leads assigned to you yet.</p>
        ) : (
          <ul className="divide-y divide-white/10 rounded-lg border border-white/10 bg-black/20">
            {leads.map((l) => {
              const options = forwardLeadStatuses(l.status);
              const valueText =
                l.value != null && l.value > 0 ? `₹${l.value.toLocaleString("en-IN")}` : null;
              return (
                <li key={l.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-medium text-white">{l.name || "Lead"}</p>
                    <p className="text-sm text-white/55">
                      <span className="tabular-nums">{l.phone}</span>
                      <span className="text-white/35"> · </span>
                      <span>{l.statusLabel}</span>
                      {valueText ? (
                        <>
                          <span className="text-white/35"> · </span>
                          <span className="tabular-nums text-white/70">{valueText}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="w-full shrink-0 sm:max-w-[14rem]">
                    {options.length > 0 ? (
                      <>
                        <label className="sr-only" htmlFor={"lead-status-" + l.id}>
                          Update status for {l.name}
                        </label>
                        <select
                          id={"lead-status-" + l.id}
                          defaultValue=""
                          disabled={busy === l.id}
                          onChange={(e) => {
                            const v = e.target.value as LeadStatus;
                            if (v) void updateStatus(l.id, v);
                            e.target.value = "";
                          }}
                          className="min-h-11 w-full cursor-pointer rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50 disabled:opacity-50"
                        >
                          <option value="" disabled>
                            Update status…
                          </option>
                          {options.map((st) => (
                            <option key={st} value={st}>
                              {leadStatusLabel(st)}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <p className="text-sm text-white/40">Closed</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </IcPanel>

      <IcPanel title="Follow-ups">
        <p className="mb-4 text-xs text-white/40">
          Scheduled tasks with a due date — call or act before the time shown.
        </p>
        {followUps.length === 0 ? (
          <p className="text-sm text-white/45">No scheduled follow-ups.</p>
        ) : (
          <ul className="divide-y divide-white/10 rounded-lg border border-white/10 bg-black/20">
            {followUps.map((t) => {
              const due = formatDueLabel(t.dueDate);
              return (
                <li
                  key={t.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium text-white">{t.title || "Task"}</p>
                    {t.lead ? (
                      <p className="text-xs text-white/45">Lead: {t.lead.name}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      {due ? (
                        <span className="text-xs tabular-nums text-cyan-200/90">{due}</span>
                      ) : null}
                      {t.overdue ? (
                        <span className="inline-flex rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                          Overdue
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy === t.id}
                    onClick={() => void completeTask(t.id)}
                    className="min-h-11 w-full shrink-0 rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 sm:w-auto"
                  >
                    Mark done
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </IcPanel>

      <IcPanel title="Tasks">
        {generalTasks.length === 0 ? (
          <p className="text-sm text-white/45">No other pending tasks.</p>
        ) : (
          <ul className="divide-y divide-white/10 rounded-lg border border-white/10 bg-black/20">
            {generalTasks.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-white">{t.title || "Task"}</p>
                  {t.lead ? (
                    <p className="text-xs text-white/45">Lead: {t.lead.name}</p>
                  ) : null}
                  {t.overdue ? (
                    <span className="inline-flex rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                      Overdue
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busy === t.id}
                  onClick={() => void completeTask(t.id)}
                  className="min-h-11 w-full shrink-0 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50 sm:w-auto"
                >
                  Mark complete
                </button>
              </li>
            ))}
          </ul>
        )}
      </IcPanel>
    </IceconnectWorkspaceView>
  );
}
