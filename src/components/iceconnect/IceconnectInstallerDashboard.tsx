"use client";

import { useCallback, useEffect, useState } from "react";
import { IceconnectWorkspaceView } from "./IceconnectWorkspaceView";
import { IcPanel } from "./IcPanel";

type Job = {
  id: string;
  status: string;
  scheduledDate: string | null;
  notes: string | null;
  completedAt: string | null;
};

export function IceconnectInstallerDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/iceconnect/installer/jobs", { credentials: "include" });
      if (!res.ok) {
        let msg = "Could not load jobs.";
        try {
          const j = (await res.json()) as { error?: string };
          if (typeof j.error === "string" && j.error.trim()) msg = j.error;
        } catch {
          /* ignore */
        }
        setErr(msg);
        return;
      }
      const data = (await res.json()) as { jobs: Job[] };
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch {
      setErr("Network error — check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markComplete(id: string) {
    const notes = completionNotes[id]?.trim() || "Marked complete from ICECONNECT";
    setBusy(id);
    try {
      const res = await fetch("/api/iceconnect/installer/complete", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId: id,
          status: "Completed",
          notes,
        }),
      });
      if (!res.ok) {
        setErr("Could not update installation.");
        return;
      }
      setCompletionNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <IceconnectWorkspaceView
      title="Installations"
      subtitle="Jobs assigned to you only."
      loading={loading}
      error={err}
      onRetry={() => void load()}
    >
      <IcPanel title="Installation jobs">
        {jobs.length === 0 ? (
          <p className="text-sm text-white/45">No installations assigned.</p>
        ) : (
          <ul className="space-y-6">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-white/40">{j.id.slice(0, 12)}…</p>
                  <p className="text-sm font-medium text-white">Status: {j.status}</p>
                  {j.scheduledDate ? (
                    <p className="text-xs text-white/45">
                      Scheduled: {new Date(j.scheduledDate).toLocaleString()}
                    </p>
                  ) : null}
                  {j.notes ? (
                    <p className="mt-2 text-sm text-white/55">
                      <span className="text-white/35">Notes: </span>
                      {j.notes}
                    </p>
                  ) : null}
                  {j.completedAt ? (
                    <p className="mt-2 text-xs text-emerald-400/90">Completed</p>
                  ) : null}
                </div>
                {!j.completedAt && j.status.toLowerCase() !== "completed" ? (
                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-72">
                    <label className="text-xs text-white/45" htmlFor={`notes-${j.id}`}>
                      Completion note (optional)
                    </label>
                    <textarea
                      id={`notes-${j.id}`}
                      value={completionNotes[j.id] ?? ""}
                      onChange={(e) =>
                        setCompletionNotes((prev) => ({ ...prev, [j.id]: e.target.value }))
                      }
                      rows={2}
                      placeholder="e.g. panels mounted, inverter tested"
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-500/40"
                    />
                    <button
                      type="button"
                      disabled={busy === j.id}
                      onClick={() => void markComplete(j.id)}
                      className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
                    >
                      Mark complete
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </IcPanel>
    </IceconnectWorkspaceView>
  );
}
