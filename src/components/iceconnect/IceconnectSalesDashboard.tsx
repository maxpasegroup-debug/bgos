"use client";

import { LeadStatus, TaskStatus } from "@prisma/client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";
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

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function IceconnectSalesDashboard() {
  const { company } = useCompanyBranding();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState("");

  useEffect(() => {
    let c = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const j = (await res.json()) as { user?: { name?: string; role?: string } };
        if (!c) return;
        if (typeof j.user?.name === "string" && j.user.name.trim()) {
          setEmployeeName(j.user.name.trim());
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      c = false;
    };
  }, []);

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
        setErr(
          formatIceApiError(
            json,
            res.status === 401 ? "Session expired — sign in again." : "Could not load your workspace.",
          ),
        );
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

  const tasksDueToday = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const tom = today + 86400000;
    return followUps.filter((t) => {
      if (!t.dueDate) return false;
      const ts = new Date(t.dueDate).getTime();
      return ts >= today && ts < tom;
    }).length;
  }, [followUps]);

  const nexaAssist = useMemo(() => {
    const urgent = tasks.find((t) => t.status === TaskStatus.PENDING && t.overdue);
    if (urgent) {
      const who = urgent.lead?.name ?? urgent.title;
      return { line: `Follow up: ${who}`, sub: "Overdue — prioritize this touchpoint" };
    }
    const hot = leads.find(
      (l) => l.status === LeadStatus.QUALIFIED || l.status === LeadStatus.NEW,
    );
    if (hot) {
      return { line: `Call ${hot.name}`, sub: "Hot lead — move the conversation forward" };
    }
    if (leads.length > 0) {
      const l = leads[0];
      return { line: `Nurture ${l.name}`, sub: l.statusLabel };
    }
    return {
      line: "Review your pipeline",
      sub: "No urgent items — stay ready for new assignments.",
    };
  }, [tasks, leads]);

  const performanceScore = useMemo(() => {
    if (!stats) return null;
    const base = 100;
    const penalty = stats.overdueTaskCount * 12 + Math.max(0, stats.pendingTaskCount - 5) * 2;
    return Math.max(35, Math.min(100, base - penalty));
  }, [stats]);

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

  const cName = company?.name?.trim() ?? "your company";
  const welcomeName = employeeName || "there";

  const hero = (
      <div className="space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-gray-200/90 bg-white/80 p-6 shadow-sm backdrop-blur-md"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--ice-primary)]">
            {cName}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
            Welcome back, {welcomeName}
          </h2>
          <p className="mt-1 text-sm text-gray-500">Here’s your work for today</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/iceconnect/internal-sales"
              className="inline-flex min-h-10 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 shadow-sm transition hover:border-[color:var(--ice-primary)] hover:bg-gray-50"
            >
              Team pipeline
            </Link>
            <Link
              href="/lead"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 shadow-sm transition hover:border-[color:var(--ice-primary)] hover:bg-gray-50"
            >
              Add lead
            </Link>
          </div>
        </motion.div>

        {stats ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.35 }}
              className="rounded-xl border border-gray-200/90 bg-white/85 p-4 shadow-sm backdrop-blur-sm transition hover:shadow-md"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Tasks due today
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{tasksDueToday}</p>
              <p className="mt-1 text-xs text-gray-500">
                {stats.overdueTaskCount > 0 ? (
                  <span className="font-medium text-amber-700">
                    {stats.overdueTaskCount} urgent overdue
                  </span>
                ) : (
                  "On track"
                )}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="rounded-xl border border-gray-200/90 bg-white/85 p-4 shadow-sm backdrop-blur-sm transition hover:shadow-md"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Assigned leads
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                {stats.leadCount}
              </p>
              <p className="mt-1 text-xs text-gray-500">Quick status updates below</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35 }}
              className="rounded-xl border border-gray-200/90 bg-white/85 p-4 shadow-sm backdrop-blur-sm transition hover:shadow-md"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Performance
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                {performanceScore ?? "—"}
              </p>
              <p className="mt-1 text-xs text-gray-500">Tasks completed vs pending balance</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white/90 p-4 shadow-sm backdrop-blur-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/80">
                NEXA assist
              </p>
              <p className="mt-2 text-sm font-semibold text-gray-900">Next action:</p>
              <p className="mt-0.5 text-sm text-gray-700">{nexaAssist.line}</p>
              <p className="mt-2 text-xs text-gray-500">{nexaAssist.sub}</p>
            </motion.div>
          </div>
        ) : null}
      </div>
  );

  const gradientBtn =
    "min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg hover:brightness-105 disabled:opacity-50";
  const gradientStyle = {
    background: "linear-gradient(90deg, var(--ice-primary), var(--ice-secondary))",
  } as CSSProperties;

  return (
    <IceconnectWorkspaceView
      title="Sales"
      subtitle="Leads assigned to you, tasks, and scheduled follow-ups."
      loading={loading}
      error={err}
      onRetry={() => void load()}
      hero={hero}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="min-h-11 min-w-[5.5rem] rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:shadow disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <IcPanel title="Assigned leads">
        {leads.length === 0 ? (
          <p className="text-sm text-gray-500">No leads assigned to you yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white/90">
            {leads.map((l) => {
              const options = forwardLeadStatuses(l.status);
              const valueText =
                l.value != null && l.value > 0 ? `₹${l.value.toLocaleString("en-IN")}` : null;
              return (
                <li
                  key={l.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-medium text-gray-900">{l.name || "Lead"}</p>
                    <p className="text-sm text-gray-600">
                      <span className="tabular-nums">{l.phone}</span>
                      <span className="text-gray-300"> · </span>
                      <span>{l.statusLabel}</span>
                      {valueText ? (
                        <>
                          <span className="text-gray-300"> · </span>
                          <span className="tabular-nums text-gray-700">{valueText}</span>
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
                          className="min-h-11 w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[color:var(--ice-primary)] focus:ring-2 focus:ring-[color:var(--ice-primary)] disabled:opacity-50"
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
                      <p className="text-sm text-gray-400">Closed</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </IcPanel>

      <IcPanel title="Follow-ups">
        <p className="mb-4 text-xs text-gray-500">
          Scheduled tasks with a due date — call or act before the time shown.
        </p>
        {followUps.length === 0 ? (
          <p className="text-sm text-gray-500">No scheduled follow-ups.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white/90">
            {followUps.map((t) => {
              const due = formatDueLabel(t.dueDate);
              return (
                <li
                  key={t.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium text-gray-900">{t.title || "Task"}</p>
                    {t.lead ? (
                      <p className="text-xs text-gray-500">Lead: {t.lead.name}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      {due ? (
                        <span className="text-xs tabular-nums text-[color:var(--ice-primary)]">
                          {due}
                        </span>
                      ) : null}
                      {t.overdue ? (
                        <span className="inline-flex rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                          Overdue
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy === t.id}
                    onClick={() => void completeTask(t.id)}
                    className={gradientBtn}
                    style={gradientStyle}
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
          <p className="text-sm text-gray-500">No other pending tasks.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white/90">
            {generalTasks.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-gray-900">{t.title || "Task"}</p>
                  {t.lead ? (
                    <p className="text-xs text-gray-500">Lead: {t.lead.name}</p>
                  ) : null}
                  {t.overdue ? (
                    <span className="inline-flex rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      Overdue
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busy === t.id}
                  onClick={() => void completeTask(t.id)}
                  className="min-h-11 w-full shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
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
