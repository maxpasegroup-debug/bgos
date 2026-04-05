"use client";

import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async () => {
    const res = await fetch("/api/iceconnect/installer/jobs", { credentials: "include" });
    if (!res.ok) {
      setErr("Could not load jobs");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { jobs: Job[] };
    setJobs(data.jobs);
    setErr(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markComplete(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/iceconnect/installer/complete", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId: id,
          status: "Completed",
          notes: "Marked complete from ICECONNECT",
        }),
      });
      if (!res.ok) {
        setErr("Could not update installation");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-white/50">Loading installation tasks…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Installations</h1>
        <p className="mt-1 text-sm text-white/50">Jobs assigned to you.</p>
      </div>
      {err ? (
        <p className="text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      <IcPanel title="Installation tasks">
        {jobs.length === 0 ? (
          <p className="text-sm text-white/45">No installations assigned.</p>
        ) : (
          <ul className="space-y-4">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-mono text-xs text-white/40">{j.id.slice(0, 12)}…</p>
                  <p className="text-sm font-medium text-white">Status: {j.status}</p>
                  {j.scheduledDate ? (
                    <p className="text-xs text-white/45">
                      Scheduled: {new Date(j.scheduledDate).toLocaleString()}
                    </p>
                  ) : null}
                  {j.completedAt ? (
                    <p className="text-xs text-emerald-400/90">Completed</p>
                  ) : null}
                </div>
                {!j.completedAt && j.status.toLowerCase() !== "completed" ? (
                  <button
                    type="button"
                    disabled={busy === j.id}
                    onClick={() => void markComplete(j.id)}
                    className="shrink-0 rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
                  >
                    Mark complete
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </IcPanel>
    </div>
  );
}
