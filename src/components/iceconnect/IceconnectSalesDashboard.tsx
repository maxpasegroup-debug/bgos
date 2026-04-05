"use client";

import { LeadStatus, TaskStatus } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
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
  lead: { id: string; name: string } | null;
};

type SalesStats = {
  leadCount: number;
  pendingTaskCount: number;
  overdueTaskCount: number;
};

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
      const data = (await res.json()) as {
        leads: LeadRow[];
        tasks: TaskRow[];
        stats?: SalesStats;
      };
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      setStats(
        data.stats &&
          typeof data.stats.leadCount === "number" &&
          typeof data.stats.pendingTaskCount === "number" &&
          typeof data.stats.overdueTaskCount === "number"
          ? data.stats
          : null,
      );
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

  const pendingTasks = tasks.filter((t) => t.status === TaskStatus.PENDING);

  return (
    <IceconnectWorkspaceView
      title="Sales"
      subtitle="Your assigned leads and tasks only — other telecallers’ data is hidden."
      loading={loading}
      error={err}
      onRetry={() => void load()}
    >
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-white/45">Leads</p>
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
                      {l.value != null && l.value > 0 ? ` · ₹${l.value.toLocaleString("en-IN")}` : ""}
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
        {pendingTasks.length === 0 ? (
          <p className="text-sm text-white/45">No pending tasks.</p>
        ) : (
          <ul className="space-y-3">
            {pendingTasks.map((t) => (
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
    </IceconnectWorkspaceView>
  );
}
