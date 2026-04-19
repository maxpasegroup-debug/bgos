"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import { glassCard, subtleText, btnPrimary, btnGhost } from "@/components/internal/internalUi";

type QItem = {
  id: string;
  companyName: string;
  pipelineStage: string;
  uiStage: "SETUP" | "CONFIG" | "TESTING" | "READY";
  priority: string;
  tier: string | null;
  updatedAt: string;
};

function columnForItem(ui: QItem["uiStage"], pipeline: string): "new" | "progress" | "done" {
  if (ui === "READY" || pipeline === "READY") return "done";
  if (ui === "CONFIG" || ui === "TESTING") return "progress";
  return "new";
}

export function TechQueueDashboard() {
  const [items, setItems] = useState<QItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/bgos/control/tech-queue", { credentials: "include" });
      const j = (await readApiJson(res, "tech-q")) as { ok?: boolean; items?: QItem[] };
      if (!res.ok || !j.ok || !Array.isArray(j.items)) {
        setErr("Could not load tech queue");
        setItems([]);
        return;
      }
      setItems(j.items);
    } catch (e) {
      setErr(formatFetchFailure(e, "Queue load failed"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "advance" | "complete") {
    setBusy(id);
    try {
      const res = await apiFetch(`/api/internal/onboarding-tasks/${id}/pipeline`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = (await readApiJson(res, "tech-pipe")) as { ok?: boolean };
      if (res.ok && j.ok) await load();
    } finally {
      setBusy(null);
    }
  }

  const cols = {
    new: [] as QItem[],
    progress: [] as QItem[],
    done: [] as QItem[],
  };
  for (const it of items) {
    cols[columnForItem(it.uiStage, it.pipelineStage)].push(it);
  }

  function Card({ it }: { it: QItem }) {
    return (
      <div className="mb-3 rounded-xl border border-white/[0.07] bg-black/35 p-3">
        <p className="font-medium text-white">{it.companyName}</p>
        <p className={`${subtleText} text-xs`}>
          Request: {it.pipelineStage.replace(/_/g, " ")} · {it.priority} tier
          {it.tier ? ` · ${it.tier}` : ""}
        </p>
        <p className={`${subtleText} mt-1 text-[11px]`}>Updated {new Date(it.updatedAt).toLocaleString()}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {it.uiStage !== "READY" ? (
            <>
              <button
                type="button"
                className={btnPrimary}
                disabled={busy === it.id}
                onClick={() => void act(it.id, "advance")}
              >
                {busy === it.id ? "…" : "Start / Next"}
              </button>
              <button
                type="button"
                className={btnGhost}
                disabled={busy === it.id}
                onClick={() => void act(it.id, "complete")}
              >
                Complete
              </button>
            </>
          ) : (
            <span className="text-xs text-emerald-300/90">Completed path</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className={`${glassCard} p-6`}>
        <h1 className="text-2xl font-bold text-white">Tech queue</h1>
        <p className={`${subtleText} mt-2`}>
          Client onboarding tasks across NEW → IN PROGRESS → COMPLETED. Actions advance the pipeline or mark ready.
        </p>
        <button type="button" className={`${btnGhost} mt-4`} onClick={() => void load()}>
          Refresh
        </button>
      </section>

      {err ? <p className="text-sm text-amber-300/90">{err}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {(
          [
            { key: "new" as const, title: "New", list: cols.new },
            { key: "progress" as const, title: "In progress", list: cols.progress },
            { key: "done" as const, title: "Completed", list: cols.done },
          ] as const
        ).map((col) => (
          <div key={col.key} className={`${glassCard} min-h-[200px] p-4`}>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">
              {col.title}{" "}
              <span className="text-white/40">({col.list.length})</span>
            </h2>
            <div className="mt-4">
              {col.list.map((it) => (
                <Card key={it.id} it={it} />
              ))}
              {col.list.length === 0 ? <p className={`${subtleText} text-sm`}>Nothing here.</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
