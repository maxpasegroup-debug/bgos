"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api-fetch";
import { glassPanel, ds } from "@/styles/design-system";
import { useInternalSession } from "./InternalSessionContext";
import { SalesNetworkRole, TechTaskPriority, TechTaskStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TechTask = {
  id: string;
  company: string;
  requestType: string;
  assignedTo: string | null;
  assignedToName: string | null;
  status: TechTaskStatus;
  priority: TechTaskPriority;
  slaDeadlineAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  responseTimeMs: number | null;
  completionTimeMs: number | null;
  createdAt: string;
  updatedAt: string;
  description?: string | null;
};

type TechStats = {
  pending: number;
  avgCompletionMs: number | null;
  avgCompletionHuman: string | null;
  slaBreached: number;
};

const STATUSES = [TechTaskStatus.NEW, TechTaskStatus.IN_PROGRESS, TechTaskStatus.COMPLETED] as const;
type Status = (typeof STATUSES)[number];

const STATUS_META: Record<Status, { label: string; color: string; dot: string; border: string }> = {
  NEW:         { label: "New",         color: "text-amber-400",   dot: "bg-amber-400",   border: "border-amber-500/30"   },
  IN_PROGRESS: { label: "In Progress", color: "text-[#4FD1FF]",   dot: "bg-[#4FD1FF]",   border: "border-[#4FD1FF]/30"   },
  COMPLETED:   { label: "Completed",   color: "text-emerald-400", dot: "bg-emerald-400", border: "border-emerald-500/30" },
};

const PRIORITY_META: Record<TechTaskPriority, { label: string; cls: string; slaColor: string }> = {
  HIGH:   { label: "High", cls: "bg-red-500/15 text-red-400 border-red-500/25",      slaColor: "text-red-400"    },
  MEDIUM: { label: "Med",  cls: "bg-amber-500/15 text-amber-400 border-amber-500/25", slaColor: "text-amber-400" },
  LOW:    { label: "Low",  cls: "bg-white/10 text-white/50 border-white/20",          slaColor: "text-white/40"  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fadeUp(i = 0) {
  return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: i * 0.05 } };
}

function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  if (h < 24) return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  const d = Math.floor(h / 24), rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

// ---------------------------------------------------------------------------
// SLA chip — live countdown
// ---------------------------------------------------------------------------

function SlaChip({ deadlineAt, status }: { deadlineAt: string | null; status: Status }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status === TechTaskStatus.COMPLETED || !deadlineAt) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [status, deadlineAt]);

  if (!deadlineAt) return null;
  if (status === TechTaskStatus.COMPLETED) return null;

  const msLeft = new Date(deadlineAt).getTime() - now;
  const breached = msLeft < 0;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
        breached
          ? "border-red-500/40 bg-red-500/15 text-red-400"
          : msLeft < 3_600_000
          ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
          : "border-white/10 bg-white/[0.04] text-white/40"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${breached ? "bg-red-400 animate-pulse" : "bg-current"}`} />
      {breached ? "SLA Breached" : `SLA ${fmtDuration(msLeft)}`}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add Task Modal
// ---------------------------------------------------------------------------

function AddTaskModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState<{ company: string; requestType: string; description: string; priority: TechTaskPriority }>({ company: "", requestType: "", description: "", priority: TechTaskPriority.MEDIUM });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim() || !form.requestType.trim()) { setErr("Company and request type are required."); return; }
    setBusy(true);
    try {
      const res = await apiFetch("/api/internal/tech/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || j.ok === false) { setErr(j.error ?? "Failed to create task"); return; }
      onAdded();
      onClose();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative ${glassPanel} w-full max-w-md p-6`}
      >
        <h3 className="text-base font-semibold text-white">New Tech Request</h3>
        <form onSubmit={submit} className="mt-4 space-y-3">
          {([
            { label: "Company",      key: "company",     placeholder: "Acme Corp"                     },
            { label: "Request Type", key: "requestType", placeholder: "Dashboard bug / API issue…"    },
          ] as const).map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-white/50">{label}</label>
              <input
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#4FD1FF]/40"
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs font-medium text-white/50">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Optional details…"
              className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#4FD1FF]/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/50">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TechTaskPriority }))}
              className="w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-3 py-2 text-sm text-white outline-none"
            >
              <option value="HIGH">High — SLA 4h</option>
              <option value="MEDIUM">Medium — SLA 24h</option>
              <option value="LOW">Low — SLA 72h</option>
            </select>
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-medium text-white/60 hover:bg-white/[0.07] transition-colors">Cancel</button>
            <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-[#4FD1FF] py-2.5 text-sm font-bold text-black hover:bg-[#4FD1FF]/90 disabled:opacity-50 transition-colors">{busy ? "Creating…" : "Create"}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task card
// ---------------------------------------------------------------------------

function TaskCard({
  task,
  onAction,
  canEdit,
}: {
  task: TechTask;
  onAction: (id: string, status: TechTaskStatus) => Promise<void>;
  canEdit: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const meta  = STATUS_META[task.status];
  const pMeta = PRIORITY_META[task.priority];

  async function doAction(status: TechTaskStatus) {
    setBusy(true);
    try { await onAction(task.id, status); } finally { setBusy(false); }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`rounded-[16px] border ${meta.border} bg-white/[0.03] p-4 space-y-3`}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{task.company}</p>
          <p className="text-xs text-white/40 mt-0.5">{task.requestType}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${pMeta.cls}`}>
          {pMeta.label}
        </span>
      </div>

      {task.description && (
        <p className="text-xs text-white/40 leading-relaxed line-clamp-2">{task.description}</p>
      )}

      {/* SLA + meta */}
      <div className="flex flex-wrap items-center gap-2">
        <SlaChip deadlineAt={task.slaDeadlineAt} status={task.status} />
        {task.assignedToName && (
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/30">
            → {task.assignedToName}
          </span>
        )}
        {task.completionTimeMs !== null && task.status === TechTaskStatus.COMPLETED && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
            ✓ {fmtDuration(task.completionTimeMs)}
          </span>
        )}
        <span className="text-[10px] text-white/20">
          {new Date(task.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </span>
      </div>

      {/* Actions */}
      {canEdit && task.status !== TechTaskStatus.COMPLETED && (
        <div className="flex gap-2 pt-1">
          {task.status === TechTaskStatus.NEW && (
            <button
              onClick={() => doAction(TechTaskStatus.IN_PROGRESS)}
              disabled={busy}
              className="flex-1 rounded-lg bg-[#4FD1FF]/10 border border-[#4FD1FF]/20 py-1.5 text-xs font-medium text-[#4FD1FF] hover:bg-[#4FD1FF]/20 disabled:opacity-50 transition-colors"
            >
              {busy ? "…" : "Start"}
            </button>
          )}
          {task.status === TechTaskStatus.IN_PROGRESS && (
            <button
              onClick={() => doAction(TechTaskStatus.COMPLETED)}
              disabled={busy}
              className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
            >
              {busy ? "…" : "Complete"}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatsBar({ columns, stats }: { columns: Record<Status, TechTask[]>; stats: TechStats | null }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {/* Kanban counts */}
      {STATUSES.map((s) => (
        <div key={s} className={`${glassPanel} flex items-center gap-3 p-4`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[s].dot}`} />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{STATUS_META[s].label}</p>
            <p className={`text-xl font-bold ${STATUS_META[s].color}`}>{columns[s].length}</p>
          </div>
        </div>
      ))}

      {/* Pending (NEW + IN_PROGRESS) */}
      {stats && (
        <div className={`${glassPanel} flex items-center gap-3 p-4`}>
          <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">Pending</p>
            <p className="text-xl font-bold text-violet-400">{stats.pending}</p>
          </div>
        </div>
      )}

      {/* Avg completion */}
      {stats && (
        <div className={`${glassPanel} flex items-center gap-3 p-4`}>
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">Avg Time</p>
            <p className="text-xl font-bold text-emerald-400">{stats.avgCompletionHuman ?? "—"}</p>
          </div>
        </div>
      )}

      {/* SLA breached alert */}
      {stats && stats.slaBreached > 0 && (
        <div className={`${glassPanel} flex items-center gap-3 border-red-500/25 p-4`}>
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-400 animate-pulse" />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">SLA Breach</p>
            <p className="text-xl font-bold text-red-400">{stats.slaBreached}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function TechDashboard() {
  const { salesNetworkRole } = useInternalSession();
  const [tasks, setTasks] = useState<TechTask[]>([]);
  const [stats, setStats] = useState<TechStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const canEdit =
    salesNetworkRole === SalesNetworkRole.TECH_EXEC ||
    salesNetworkRole === SalesNetworkRole.BOSS;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/internal/tech/tasks");
      const j = await res.json() as { ok?: boolean; tasks?: TechTask[]; stats?: TechStats };
      setTasks(j.tasks ?? []);
      setStats(j.stats ?? null);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleAction(id: string, status: TechTaskStatus) {
    try {
      const res = await apiFetch(`/api/internal/tech/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const j = await res.json() as { ok?: boolean; task?: TechTask };
      if (j.ok !== false && j.task) {
        setTasks((prev) => prev.map((t) => t.id === id ? j.task! : t));
        // Refresh stats after a status change
        void load();
      }
    } catch {
      // silent
    }
  }

  const columns: Record<Status, TechTask[]> = {
    NEW:         tasks.filter((t) => t.status === TechTaskStatus.NEW),
    IN_PROGRESS: tasks.filter((t) => t.status === TechTaskStatus.IN_PROGRESS),
    COMPLETED:   tasks.filter((t) => t.status === TechTaskStatus.COMPLETED),
  };

  return (
    <div
      className="min-h-full pb-20 pt-6"
      style={{ background: `linear-gradient(180deg, ${ds.colors.bgPrimary} 0%, ${ds.colors.bgSecondary} 60%)` }}
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Header */}
        <motion.div {...fadeUp(0)} className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">Tech</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Tech Queue</h1>
            <p className="mt-1 text-sm text-white/40">Manage company requests · SLA tracked per priority</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2 text-xs font-medium text-white/50 hover:bg-white/[0.07] disabled:opacity-40 transition-colors"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
            {canEdit && (
              <button
                onClick={() => setShowAdd(true)}
                className="rounded-xl bg-sky-500/10 border border-sky-500/20 px-4 py-2 text-xs font-medium text-sky-400 hover:bg-sky-500/20 transition-colors"
              >
                + Add Task
              </button>
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div {...fadeUp(1)}>
          <StatsBar columns={columns} stats={stats} />
        </motion.div>

        {/* SLA legend */}
        <motion.div {...fadeUp(2)} className="flex flex-wrap items-center gap-3 text-[11px] text-white/30">
          <span className="font-semibold text-white/40">SLA:</span>
          <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-red-400">High — 4h</span>
          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-amber-400">Medium — 24h</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">Low — 72h</span>
        </motion.div>

        {/* Kanban */}
        <motion.div {...fadeUp(3)} className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STATUSES.map((status) => (
            <div key={status} className="space-y-3">
              {/* Column header */}
              <div className={`flex items-center gap-2 rounded-xl border ${STATUS_META[status].border} bg-white/[0.02] px-4 py-2.5`}>
                <span className={`h-2 w-2 rounded-full ${STATUS_META[status].dot}`} />
                <p className={`text-xs font-semibold uppercase tracking-widest ${STATUS_META[status].color}`}>
                  {STATUS_META[status].label}
                </p>
                <span className="ml-auto rounded-full bg-white/[0.08] px-2 py-0.5 text-xs text-white/40">
                  {columns[status].length}
                </span>
              </div>

              {/* Cards */}
              <div className="min-h-[120px] space-y-3">
                <AnimatePresence>
                  {loading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="rounded-[16px] border border-white/[0.06] bg-white/[0.03] p-4 animate-pulse">
                        <div className="mb-2 h-3 w-3/4 rounded bg-white/10" />
                        <div className="h-2.5 w-1/2 rounded bg-white/[0.07]" />
                      </div>
                    ))
                  ) : columns[status].length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-[16px] border border-white/[0.05] bg-white/[0.02] py-8 text-white/20">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" strokeWidth={1.5} d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <p className="text-xs">Empty</p>
                    </div>
                  ) : (
                    columns[status].map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onAction={handleAction}
                        canEdit={canEdit}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Add modal */}
      <AnimatePresence>
        {showAdd && <AddTaskModal onClose={() => setShowAdd(false)} onAdded={load} />}
      </AnimatePresence>
    </div>
  );
}
