"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api-fetch";
import { RoleBadge } from "@/components/ui/RoleBadge";
import type { SdeTechRequestDescription } from "@/lib/sde-tech-request-payload";
import { ChangePasswordModal } from "./ChangePasswordModal";

type SdeTask = {
  id: string;
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  deadline: string | null;
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED";
};

type TechRequestRow = {
  id: string;
  roleName: string;
  status: "PENDING" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "URGENT" | "NORMAL";
  companyId: string | null;
  companyName: string;
  industry: string | null;
  employeeCount: number;
  notes: string;
  sdeNotes: string;
  estimatedDelivery: string | null;
  assignedSdeId: string | null;
  statusHistory: Array<{ status: string; at: string; note?: string }>;
  createdAt: string;
  requestedByUser: { id: string; name: string; email: string } | null;
  description: SdeTechRequestDescription;
  completedAt: string | null;
  type: string | null;
};

type TabId = "build" | "mytasks" | "completed" | "briefing";

type SdeDashboardProps = {
  user: AuthUser;
};

const GLASS: React.CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(10px)",
  padding: 16,
};

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "No deadline";
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return "No deadline";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function priorityTone(priority: SdeTask["priority"]): React.CSSProperties {
  if (priority === "HIGH") return { color: "#fca5a5", borderColor: "rgba(248,113,113,0.35)" };
  if (priority === "LOW") return { color: "#86efac", borderColor: "rgba(74,222,128,0.35)" };
  return { color: "#fcd34d", borderColor: "rgba(251,191,36,0.35)" };
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function statusLine(status: TechRequestRow["status"]): string {
  if (status === "PENDING") return "PENDING → IN_PROGRESS → REVIEW → DONE";
  if (status === "IN_PROGRESS") return "PENDING → IN_PROGRESS → REVIEW → DONE";
  if (status === "REVIEW") return "PENDING → IN_PROGRESS → REVIEW → DONE";
  return "DONE";
}

function requestTypeMeta(roleName: string): { label: string; badge: string; className: string } {
  if (roleName === "SUPPORT_REQUEST") {
    return { label: "SUPPORT_REQUEST", badge: "🔧", className: "border-amber-300/50 bg-amber-500/15 text-amber-100" };
  }
  if (roleName === "ADD_EMPLOYEE") {
    return { label: "ADD_EMPLOYEE", badge: "➕", className: "border-emerald-300/50 bg-emerald-500/15 text-emerald-100" };
  }
  return { label: "ONBOARDING_BUILD", badge: "🏗️", className: "border-sky-400/50 bg-sky-500/15 text-sky-100" };
}

function hasIndustryTemplate(
  industry: string | null,
  doneList: TechRequestRow[],
  excludeId: string,
): boolean {
  if (!industry?.trim()) return false;
  const key = industry.trim().toLowerCase();
  return doneList.some(
    (r) => r.id !== excludeId && r.status === "DONE" && (r.industry ?? "").trim().toLowerCase() === key,
  );
}

function isOverdue(estimatedDelivery: string | null, status: TechRequestRow["status"]): boolean {
  if (status === "DONE" || !estimatedDelivery?.trim()) return false;
  const d = new Date(estimatedDelivery);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function monthStart(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).getTime();
}

function completedThisMonth(r: TechRequestRow): boolean {
  if (r.status !== "DONE") return false;
  const raw = r.completedAt ?? r.createdAt;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return false;
  return t >= monthStart();
}

export function SdeDashboard({ user }: SdeDashboardProps) {
  const [tab, setTab] = useState<TabId>("build");
  const [tasks, setTasks] = useState<SdeTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const [techRequests, setTechRequests] = useState<TechRequestRow[]>([]);
  const [techLoading, setTechLoading] = useState(true);
  const [techError, setTechError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [modal, setModal] = useState<{
    open: boolean;
    request: TechRequestRow | null;
    focusNotes: boolean;
    modalNotes: string;
  }>({ open: false, request: null, focusNotes: false, modalNotes: "" });

  const [changePwOpen, setChangePwOpen] = useState(false);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const res = await apiFetch("/api/iceconnect/sde/tasks", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { tasks?: SdeTask[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load tasks");
      setTasks(Array.isArray(json.tasks) ? json.tasks : []);
    } catch (e) {
      setTasksError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadTechRequests = useCallback(async () => {
    setTechLoading(true);
    setTechError(null);
    try {
      const res = await apiFetch("/api/sde/tech-requests", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { requests?: TechRequestRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load tech requests");
      const list = Array.isArray(json.requests) ? json.requests : [];
      setTechRequests(list);
      setNotesDraft((prev) => {
        const next = { ...prev };
        for (const r of list) {
          next[r.id] = r.sdeNotes ?? "";
        }
        return next;
      });
    } catch (e) {
      setTechError(e instanceof Error ? e.message : "Failed to load tech requests");
    } finally {
      setTechLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    void loadTechRequests();
  }, [loadTechRequests]);

  const doneList = useMemo(() => techRequests.filter((r) => r.status === "DONE"), [techRequests]);
  const buildQueue = useMemo(() => techRequests.filter((r) => r.status !== "DONE"), [techRequests]);

  const stats = useMemo(() => {
    const pending = techRequests.filter((r) => r.status === "PENDING").length;
    const inProgress = techRequests.filter((r) => r.status === "IN_PROGRESS" || r.status === "REVIEW").length;
    const completedMonth = techRequests.filter(completedThisMonth).length;
    const urgent = techRequests.filter((r) => r.priority === "URGENT" && r.status !== "DONE").length;
    const overdue = techRequests.filter((r) => isOverdue(r.estimatedDelivery, r.status)).length;
    return { pending, inProgress, completedMonth, urgent, overdue };
  }, [techRequests]);

  const name = useMemo(() => {
    const local = user.email.split("@")[0] ?? "Developer";
    if (!local) return "Developer";
    return local.charAt(0).toUpperCase() + local.slice(1);
  }, [user.email]);

  function updateTaskStatus(id: string, status: SdeTask["status"]) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status } : task)));
  }

  async function patchRequest(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    setActionBusy(id);
    try {
      const res = await apiFetch(`/api/sde/tech-requests/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      await loadTechRequests();
    } finally {
      setSavingId(null);
      setActionBusy(null);
    }
  }

  function openModal(req: TechRequestRow, focusNotes: boolean) {
    setModal({
      open: true,
      request: req,
      focusNotes,
      modalNotes: req.sdeNotes ?? "",
    });
  }

  function closeModal() {
    setModal({ open: false, request: null, focusNotes: false, modalNotes: "" });
  }

  async function saveModalNotes() {
    if (!modal.request) return;
    const id = modal.request.id;
    await patchRequest(id, { sdeNotes: modal.modalNotes });
    closeModal();
  }

  const employees = modal.request?.description?.employees;
  const employeeRows = Array.isArray(employees) ? employees : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 text-white">
      {changePwOpen && <ChangePasswordModal onClose={() => setChangePwOpen(false)} />}
      <section style={GLASS}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/80">Iceconnect Engineering</p>
            <h1 className="mt-2 text-2xl font-semibold">Hey {name}, ready to build?</h1>
            <p className="mt-1 text-sm text-white/65">SDE queue for franchise partner tech requests and your assigned tasks.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Nexa Online
            </div>
            <button
              type="button"
              onClick={() => setChangePwOpen(true)}
              aria-label="Change password"
              title="Change password"
              style={{
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.65)",
                padding: "6px 8px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ⚙
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <RoleBadge role={user.role} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[11px] uppercase text-white/50">Pending</p>
            <p className="text-xl font-bold">{stats.pending}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[11px] uppercase text-white/50">In progress</p>
            <p className="text-xl font-bold">{stats.inProgress}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[11px] uppercase text-white/50">Done (month)</p>
            <p className="text-xl font-bold">{stats.completedMonth}</p>
          </div>
          <div
            className={`rounded-lg border px-3 py-2 ${
              stats.urgent > 0
                ? "border-red-400/60 bg-red-500/20"
                : "border-white/10 bg-black/20"
            }`}
          >
            <p className="text-[11px] uppercase text-white/50">Urgent</p>
            <p className={`text-xl font-bold ${stats.urgent > 0 ? "text-red-200" : ""}`}>{stats.urgent}</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
        {(
          [
            ["build", "Build Queue"],
            ["mytasks", "My Active Tasks"],
            ["completed", "Completed"],
            ["briefing", "Nexa Briefing"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === k
                ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/40"
                : "text-white/70 hover:bg-white/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "build" && (
        <section style={GLASS}>
          <h2 className="text-lg font-semibold">Build queue</h2>
          <p className="mt-1 text-sm text-white/60">Incoming tech requests from franchise partners (excludes completed).</p>
          {techLoading ? (
            <p className="mt-3 text-sm text-white/65">Loading…</p>
          ) : techError ? (
            <p className="mt-3 text-sm text-rose-300">{techError}</p>
          ) : buildQueue.length === 0 ? (
            <p className="mt-3 text-sm text-white/65">No open requests. Great work — or check Completed.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {buildQueue.map((r) => {
                const typeMeta = requestTypeMeta(r.roleName);
                const urgent = r.priority === "URGENT";
                const bdm = r.requestedByUser?.name ?? "Franchise Partner";
                const tpl = hasIndustryTemplate(r.industry, doneList, r.id);
                return (
                  <article
                    key={r.id}
                    className={`rounded-xl border bg-black/20 p-3 ${
                      urgent ? "border-red-400/60 ring-1 ring-red-500/20" : "border-white/10"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{r.companyName}</h3>
                        <p className="text-xs text-white/55">Submitted by {bdm} (Franchise Partner) · {timeAgo(r.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeMeta.className}`}
                        >
                          {typeMeta.badge} {typeMeta.label}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            r.priority === "URGENT"
                              ? "border-red-300/50 bg-red-500/20 text-red-100"
                              : "border-white/20 bg-white/5 text-white/80"
                          }`}
                        >
                          {r.priority}
                        </span>
                        {r.roleName === "ONBOARDING_BUILD" && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              tpl
                                ? "border-emerald-300/50 bg-emerald-500/15 text-emerald-100"
                                : "border-white/20 bg-white/5 text-white/60"
                            }`}
                          >
                            {tpl ? `✓ Template available for ${r.industry ?? "industry"}` : "New industry — building from scratch"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-white/70 sm:grid-cols-2">
                      <p>Industry: {r.industry ?? "—"}</p>
                      <p>Employees: {r.employeeCount}</p>
                      <p>Est. delivery: {r.estimatedDelivery || "—"}</p>
                      <p>Flow: {statusLine(r.status)}</p>
                    </div>
                    <p className="mt-1 text-xs text-cyan-100/80">Status: {r.status}</p>

                    <div className="mt-2">
                      <p className="text-[11px] font-semibold uppercase text-white/45">SDE notes (click to edit, blur to save)</p>
                      <textarea
                        className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
                        rows={2}
                        value={notesDraft[r.id] ?? r.sdeNotes ?? ""}
                        disabled={savingId === r.id}
                        onChange={(e) => setNotesDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                        onBlur={async (e) => {
                          const v = e.target.value;
                          if (v === (r.sdeNotes ?? "")) return;
                          try {
                            await patchRequest(r.id, { sdeNotes: v });
                          } catch (err) {
                            setNotesDraft((d) => ({ ...d, [r.id]: r.sdeNotes ?? "" }));
                            console.error(err);
                          }
                        }}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.status === "PENDING" && (
                        <button
                          type="button"
                          disabled={actionBusy === r.id}
                          onClick={() => void patchRequest(r.id, { status: "IN_PROGRESS", assignedSdeId: user.sub })}
                          className="rounded-md border border-blue-300/40 bg-blue-500/15 px-2 py-1 text-xs text-blue-200"
                        >
                          Pick up
                        </button>
                      )}
                      {r.status === "IN_PROGRESS" && (
                        <>
                          <button
                            type="button"
                            onClick={() => openModal(r, true)}
                            className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-xs"
                          >
                            Update notes
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy === r.id}
                            onClick={() => void patchRequest(r.id, { status: "REVIEW" })}
                            className="rounded-md border border-amber-300/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-100"
                          >
                            Send for review
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy === r.id}
                            onClick={() => void patchRequest(r.id, { status: "DONE" })}
                            className="rounded-md border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200"
                          >
                            Mark complete
                          </button>
                        </>
                      )}
                      {r.status === "REVIEW" && (
                        <>
                          <button
                            type="button"
                            disabled={actionBusy === r.id}
                            onClick={() => void patchRequest(r.id, { status: "DONE" })}
                            className="rounded-md border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200"
                          >
                            Mark complete
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy === r.id}
                            onClick={() => void patchRequest(r.id, { status: "IN_PROGRESS" })}
                            className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-xs"
                          >
                            Send back
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => openModal(r, false)}
                        className="rounded-md border border-cyan-300/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
                      >
                        View details
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "mytasks" && (
        <section style={GLASS}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">My active tasks</h2>
            <span className="text-xs text-white/60">{tasks.length} from Task</span>
          </div>
          {tasksLoading ? (
            <p className="text-sm text-white/65">Loading tasks...</p>
          ) : tasksError ? (
            <p className="text-sm text-rose-300">{tasksError}</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-white/65">No tasks yet — Nexa will assign soon.</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <article key={task.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-medium">{task.title}</h3>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                      style={priorityTone(task.priority)}
                    >
                      {task.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/55">Deadline: {formatDeadline(task.deadline)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => updateTaskStatus(task.id, "IN_PROGRESS")}
                      className="rounded-md border border-blue-300/35 bg-blue-500/10 px-2 py-1 text-xs text-blue-200"
                      type="button"
                    >
                      In progress
                    </button>
                    <button
                      onClick={() => updateTaskStatus(task.id, "DONE")}
                      className="rounded-md border border-emerald-300/35 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200"
                      type="button"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => updateTaskStatus(task.id, "BLOCKED")}
                      className="rounded-md border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-xs text-rose-200"
                      type="button"
                    >
                      Blocked
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "completed" && (
        <section style={GLASS}>
          <h2 className="text-lg font-semibold">Completed</h2>
          {techLoading ? (
            <p className="mt-3 text-sm text-white/65">Loading…</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {doneList.length === 0 ? (
                <li className="text-sm text-white/60">No completed requests yet.</li>
              ) : (
                doneList.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{r.companyName}</span>
                    <span className="text-white/60">
                      {r.completedAt
                        ? new Date(r.completedAt).toLocaleDateString(undefined, { dateStyle: "medium" })
                        : new Date(r.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => openModal(r, false)}
                      className="rounded-md border border-cyan-300/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
                    >
                      View details
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </section>
      )}

      {tab === "briefing" && (
        <section style={GLASS}>
          <h2 className="text-lg font-semibold">Nexa briefing</h2>
          <div className="mt-3 space-y-3 text-sm text-white/80">
            <div className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 p-3">
              <p className="font-semibold text-cyan-100">Priority builds today</p>
              <p className="mt-1 text-white/70">
                Triage URGENT items first, then pick up the oldest PENDING request in the build queue.
              </p>
            </div>
            <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-3">
              <p className="font-semibold text-amber-100">Overdue items</p>
              <p className="mt-1 text-white/70">
                {stats.overdue > 0
                  ? `${stats.overdue} open request(s) are past the estimated delivery date. Re-scope or update the franchise partner.`
                  : "No open requests are past their estimated delivery date."}
              </p>
            </div>
            <div className="rounded-lg border border-violet-300/30 bg-violet-500/10 p-3">
              <p className="font-semibold text-violet-100">Performance summary</p>
              <p className="mt-1 text-white/70">
                Completed this month: {stats.completedMonth}. Urgent still open: {stats.urgent}. Keep handoffs tight between
                IN_PROGRESS and REVIEW.
              </p>
            </div>
          </div>
        </section>
      )}

      {modal.open && modal.request ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-slate-950 p-4 text-white shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold">{modal.request.companyName}</h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded border border-white/20 px-2 py-0.5 text-sm text-white/80"
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-xs text-white/60">
              {requestTypeMeta(modal.request.roleName).badge} {requestTypeMeta(modal.request.roleName).label} · {modal.request.status} · {modal.request.priority}
            </p>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase text-white/45">Company profile</p>
                <pre className="mt-1 max-h-40 overflow-auto rounded border border-white/10 bg-black/30 p-2 text-xs text-white/80">
                  {JSON.stringify(modal.request.description?.companyProfile ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-white/45">Boss details</p>
                <pre className="mt-1 max-h-32 overflow-auto rounded border border-white/10 bg-black/30 p-2 text-xs text-white/80">
                  {JSON.stringify(modal.request.description?.bossDetails ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-white/45">Employees</p>
                <div className="mt-1 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-white/50">
                        <th className="py-1 pr-2">Name</th>
                        <th className="py-1 pr-2">Role</th>
                        <th className="py-1 pr-2">Department</th>
                        <th className="py-1">Features</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-2 text-white/50">
                            No employees in payload.
                          </td>
                        </tr>
                      ) : (
                        employeeRows.map((em, i) => (
                          <tr key={i} className="border-b border-white/5">
                            <td className="py-1 pr-2">{em.name}</td>
                            <td className="py-1 pr-2">{em.role}</td>
                            <td className="py-1 pr-2">{em.department}</td>
                            <td className="py-1 text-white/70">
                              {Array.isArray(em.featuresNeeded) ? em.featuresNeeded.join(", ") : String(em.featuresNeeded ?? "—")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-white/45">Franchise Partner Notes</p>
                <p className="mt-1 rounded border border-white/10 bg-black/20 p-2 text-white/80">{modal.request.notes || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-white/45">SDE notes</p>
                <textarea
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm"
                  rows={4}
                  value={modal.modalNotes}
                  autoFocus={modal.focusNotes}
                  onChange={(e) => setModal((m) => ({ ...m, modalNotes: e.target.value }))}
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-white/45">Status history</p>
                <ul className="mt-1 list-inside list-disc text-white/70">
                  {(modal.request.statusHistory ?? []).length === 0 ? (
                    <li>—</li>
                  ) : (
                    modal.request.statusHistory.map((h, i) => (
                      <li key={`${h.at}-${i}`}>
                        {h.status} · {new Date(h.at).toLocaleString()}{h.note ? ` — ${h.note}` : ""}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveModalNotes()}
                className="rounded-md border border-cyan-300/50 bg-cyan-500/20 px-3 py-1.5 text-sm text-cyan-100"
              >
                Save notes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
