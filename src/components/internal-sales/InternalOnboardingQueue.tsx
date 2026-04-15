"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { TechPipelineStage } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";

type QTask = {
  id: string;
  status: string;
  pipelineStage: TechPipelineStage;
  techQueuePriority: string;
  priorityLabel: string;
  leadOnboardingType: string | null;
  companyName: string;
  ownerName: string;
  phone: string;
  lead: { id: string; name: string; phone: string };
  updatedAt: string;
};

type QCol = { key: TechPipelineStage; label: string; tasks: QTask[] };

function readQueue(j: unknown): QCol[] | null {
  if (typeof j !== "object" || j === null || !("ok" in j) || (j as { ok?: unknown }).ok !== true) {
    return null;
  }
  const queue = (j as { queue?: unknown }).queue;
  if (!Array.isArray(queue)) return null;
  return queue as QCol[];
}

export function InternalOnboardingQueue({ theme }: { theme: "bgos" | "ice" }) {
  const [queue, setQueue] = useState<QCol[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const shell =
    theme === "bgos"
      ? "min-h-screen px-4 pb-16 pt-6 text-white"
      : "min-h-screen bg-slate-50 px-4 pb-16 pt-6 text-slate-900";
  const card =
    theme === "bgos"
      ? "rounded-xl border border-white/10 bg-white/[0.04] p-3"
      : "rounded-xl border border-slate-200 bg-white p-3 shadow-sm";

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/internal-sales/onboarding", { credentials: "include" });
      const j: unknown = await res.json();
      if (!res.ok) {
        setErr(typeof j === "object" && j && "error" in j ? String((j as { error: string }).error) : "Load failed");
        return;
      }
      setQueue(readQueue(j) ?? []);
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function advancePipeline(id: string) {
    setBusy(id);
    try {
      const res = await apiFetch(`/api/internal-sales/onboarding/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advancePipeline: true }),
      });
      if (!res.ok) {
        const j: unknown = await res.json();
        setErr(typeof j === "object" && j && "error" in j ? String((j as { error: string }).error) : "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className={`${shell} flex items-center justify-center`}>
        <p className="opacity-60">Loading queue…</p>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="mx-auto max-w-7xl space-y-4">
        <header>
          <h1 className="text-xl font-semibold sm:text-2xl">Onboarding queue</h1>
          <p className={theme === "bgos" ? "text-sm text-white/55" : "text-sm text-slate-500"}>
            Enterprise → Pro → Basic sort. Advance one pipeline step at a time (no skipping). Ready notifies sales.
          </p>
        </header>
        {err ? (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-100">{err}</div>
        ) : null}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {queue.map((col) => (
            <div key={col.key} className={`w-[min(100%,300px)] shrink-0 ${card}`}>
              <p className="text-xs font-semibold uppercase opacity-70">{col.label}</p>
              <p className="text-[11px] opacity-50">{col.tasks.length}</p>
              <ul className="mt-2 space-y-2">
                {col.tasks.map((t) => (
                  <li
                    key={t.id}
                    className={
                      theme === "bgos"
                        ? "rounded-lg border border-white/10 bg-black/25 p-2 text-xs"
                        : "rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs"
                    }
                  >
                    <p className="font-medium">{t.companyName}</p>
                    <p className="opacity-70">{t.ownerName}</p>
                    <p className="mt-1 text-[10px] opacity-60">{t.phone}</p>
                    <p className="mt-1 text-[10px] font-medium text-amber-200/90">{t.priorityLabel}</p>
                    {t.pipelineStage !== TechPipelineStage.READY ? (
                      <button
                        type="button"
                        disabled={busy === t.id}
                        onClick={() => void advancePipeline(t.id)}
                        className="mt-2 w-full rounded-lg bg-indigo-600 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                      >
                        {busy === t.id ? "…" : "Complete step →"}
                      </button>
                    ) : (
                      <p className="mt-2 text-[10px] text-emerald-300/90">Handed to sales for delivery</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
