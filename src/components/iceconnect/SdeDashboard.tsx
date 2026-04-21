"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@/lib/auth";

type SdeTask = {
  id: string;
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  deadline: string | null;
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED";
};

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

function roleLabel(role: string): string {
  if (role === "TECH_EXECUTIVE") return "SDE";
  if (role === "TECH_HEAD") return "SDE Lead";
  return role;
}

export function SdeDashboard({ user }: SdeDashboardProps) {
  const [tasks, setTasks] = useState<SdeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadTasks() {
      try {
        const res = await fetch("/api/iceconnect/sde/tasks", { credentials: "include" });
        const json = (await res.json().catch(() => ({}))) as { tasks?: SdeTask[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load tasks");
        if (!cancelled) setTasks(Array.isArray(json.tasks) ? json.tasks : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load tasks");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadTasks();
    return () => {
      cancelled = true;
    };
  }, []);

  const name = useMemo(() => {
    const local = user.email.split("@")[0] ?? "Developer";
    if (!local) return "Developer";
    return local.charAt(0).toUpperCase() + local.slice(1);
  }, [user.email]);

  function updateTaskStatus(id: string, status: SdeTask["status"]) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status } : task)));
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 text-white">
      <section style={GLASS}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/80">Iceconnect Engineering</p>
            <h1 className="mt-2 text-2xl font-semibold">Hey {name}, ready to build?</h1>
            <p className="mt-1 text-sm text-white/65">SDE task hub for bugs, features, and deployment work.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Nexa Online
          </div>
        </div>
        <div className="mt-3 inline-flex rounded-full border border-violet-300/35 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
          {roleLabel(user.role)} - Software Dev Executive
        </div>
      </section>

      <section style={GLASS}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Tasks</h2>
          <span className="text-xs text-white/60">{tasks.length} active</span>
        </div>
        {loading ? (
          <p className="text-sm text-white/65">Loading tasks...</p>
        ) : error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-white/65">No tasks yet - Nexa will assign soon</p>
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
                    In Progress
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

      <section className="grid gap-4 md:grid-cols-2">
        <div style={GLASS}>
          <h2 className="text-lg font-semibold">Tech Queue</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/75">
            <li className="rounded-lg border border-red-300/25 bg-red-500/10 px-3 py-2">High - Payment webhook retry bug</li>
            <li className="rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-2">Medium - Lead status audit trail enhancement</li>
            <li className="rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-3 py-2">Low - Dashboard card layout polish</li>
          </ul>
        </div>
        <div style={GLASS}>
          <h2 className="text-lg font-semibold">Nexa Briefing</h2>
          <div className="mt-3 rounded-lg border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm text-cyan-100">
            Nexa says: Prioritize release blockers first, ship one bug fix before noon, and post deployment notes in the team channel.
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Quick Actions</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs">
                Mark task complete
              </button>
              <button type="button" className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs">
                Report a blocker
              </button>
              <button type="button" className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs">
                Request clarification
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
