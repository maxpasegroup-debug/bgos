"use client";

import { LeadStatus, TaskStatus } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { forwardLeadStatuses, leadStatusLabel } from "@/lib/lead-pipeline";
import { IcPanel } from "./IcPanel";

type LeadRow = {
  id: string;
  name: string;
  status: LeadStatus;
  statusLabel: string;
  phone: string;
};

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  overdue: boolean;
  lead: { id: string; name: string } | null;
};

export function IceconnectSalesDashboard() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/iceconnect/sales/data", { credentials: "include" });
      if (!res.ok) {
        let msg = "Could not load your workspace.";
        try {
          const j = (await res.json()) as { error?: string; code?: string };
          if (typeof j.error === "string" && j.error.trim()) msg = j.error;
          else if (res.status === 401) msg = "Session expired — sign in again.";
        } catch {
          /* ignore */
        }
        setErr(msg);
        return;
      }
      const data = (await res.json()) as { leads: LeadRow[]; tasks: TaskRow[] };
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch {
      setErr("Network error — check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(leadId: string, status: LeadStatus) {
    setBusy(leadId);
    try {
      const res = await fetch("/api/iceconnect/sales/lead-status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setErr(typeof j.error === "string" ? j.error : "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function completeTask(taskId: string) {
    setBusy(taskId);
    try {
      const res = await fetch("/api/tasks/complete", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) {
        setErr("Could not complete task");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading sales workspace">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/10" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-white/5" />
        </div>
        <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Sales</h1>
        <p className="mt-1 text-sm text-white/50">Your leads and tasks only.</p>
      </div>
      {err ? (
        <div
          className="flex flex-col gap-4 rounded-xl border border-red-500/25 bg-red-500/5 p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm text-red-300">{err}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
          >
            Retry
          </button>
        </div>
      ) : null}

      <IcPanel title="Leads">
        {leads.length === 0 ? (
          <p className="text-sm text-white/45">No leads assigned to you.</p>
        ) : (
          <ul className="space-y-4">
            {leads.map((l) => {
              const options = forwardLeadStatuses(l.status);
              return (
                <li
                  key={l.id}
                  className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-white">{l.name}</p>
                    <p className="text-xs text-white/45">
                      {l.phone} · {l.statusLabel}
                    </p>
                  </div>
                  {options.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {options.map((st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={busy === l.id}
                          onClick={() => void updateStatus(l.id, st)}
                          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
                        >
                          → {leadStatusLabel(st)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-white/40">Closed</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </IcPanel>

      <IcPanel title="Tasks">
        {tasks.filter((t) => t.status === TaskStatus.PENDING).length === 0 ? (
          <p className="text-sm text-white/45">No pending tasks.</p>
        ) : (
          <ul className="space-y-3">
            {tasks
              .filter((t) => t.status === TaskStatus.PENDING)
              .map((t) => (
                <li
                  key={t.id}
                  className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm text-white">{t.title}</p>
                    {t.lead ? (
                      <p className="text-xs text-white/45">Lead: {t.lead.name}</p>
                    ) : null}
                    {t.overdue ? (
                      <span className="mt-1 inline-block rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                        Overdue
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={busy === t.id}
                    onClick={() => void completeTask(t.id)}
                    className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-50"
                  >
                    Complete
                  </button>
                </li>
              ))}
          </ul>
        )}
      </IcPanel>
    </div>
  );
}
