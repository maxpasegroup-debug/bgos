"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";
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
  const { company } = useCompanyBranding();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});

  const btnStyle = {
    background: "linear-gradient(90deg, var(--ice-primary), var(--ice-secondary))",
  } as CSSProperties;

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

  const cn = company?.name?.trim() ?? "your company";
  const pending = jobs.filter((j) => !j.completedAt && j.status.toLowerCase() !== "completed").length;
  const hero = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-gray-200/90 bg-white/85 p-5 shadow-sm backdrop-blur-md"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--ice-primary)]">
        Installer · {cn}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-gray-900">Installation jobs</h2>
      <p className="mt-1 text-sm text-gray-500">
        {pending > 0 ? `${pending} active job(s) on your board.` : "No active installs — you’re clear."}
      </p>
    </motion.div>
  );

  return (
    <IceconnectWorkspaceView
      title="Installations"
      subtitle="Jobs assigned to you only."
      loading={loading}
      error={err}
      onRetry={() => void load()}
      hero={hero}
    >
      <IcPanel title="Field checklist">
        <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
          <li>Safety & harness verification</li>
          <li>Panel / inverter commissioning steps</li>
          <li>Customer walkthrough before closure</li>
        </ul>
      </IcPanel>

      <IcPanel title="Installation jobs">
        {jobs.length === 0 ? (
          <p className="text-sm text-gray-500">No installations assigned.</p>
        ) : (
          <ul className="space-y-6">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white/90 p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-gray-400">{j.id.slice(0, 12)}…</p>
                  <p className="text-sm font-medium text-gray-900">Status: {j.status}</p>
                  {j.scheduledDate ? (
                    <p className="text-xs text-gray-500">
                      Scheduled: {new Date(j.scheduledDate).toLocaleString()}
                    </p>
                  ) : null}
                  {j.notes ? (
                    <p className="mt-2 text-sm text-gray-600">
                      <span className="text-gray-400">Notes: </span>
                      {j.notes}
                    </p>
                  ) : null}
                  {j.completedAt ? (
                    <p className="mt-2 text-xs font-medium text-emerald-700">Completed</p>
                  ) : null}
                </div>
                {!j.completedAt && j.status.toLowerCase() !== "completed" ? (
                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-72">
                    <label className="text-xs text-gray-500" htmlFor={`notes-${j.id}`}>
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
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[color:var(--ice-primary)] focus:ring-2 focus:ring-[color:var(--ice-primary)]"
                    />
                    <button
                      type="button"
                      disabled={busy === j.id}
                      onClick={() => void markComplete(j.id)}
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
                      style={btnStyle}
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
