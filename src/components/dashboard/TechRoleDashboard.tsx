"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api-fetch";
import { glassPanel, headingClass, bodyMutedClass } from "@/styles/design-system";

type Row = {
  id: string;
  request_id: string;
  status: string;
  assignee_name: string | null;
  updated_at: string;
};

export function TechRoleDashboard() {
  const [items, setItems] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/sales-network/tech-board", { credentials: "include" });
      const j = (await readApiJson(res, "tech-board")) as { ok?: boolean; items?: Row[] };
      if (!res.ok || j.ok === false) {
        setErr("Could not load tech queue.");
        return;
      }
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch {
      setErr("Could not load tech queue.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const col = (label: string, pred: (s: string) => boolean) => (
    <section className={`${glassPanel} p-6`}>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">{label}</h2>
      <ul className="mt-4 space-y-3">
        {items.filter((i) => pred(i.status)).length === 0 ? (
          <li className="text-sm text-white/40">None</li>
        ) : (
          items
            .filter((i) => pred(i.status))
            .map((i) => (
              <li
                key={i.id}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90"
              >
                <span className="font-mono text-xs text-slate-400">{i.request_id}</span>
                <span className="ml-2 text-xs uppercase text-slate-500">{i.status}</span>
                {i.assignee_name ? (
                  <span className="mt-1 block text-xs text-slate-400">{i.assignee_name}</span>
                ) : null}
              </li>
            ))
        )}
      </ul>
    </section>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <p className={bodyMutedClass}>Technical delivery</p>
          <h1 className={`${headingClass} mt-2`}>Tech dashboard</h1>
        </header>
        {err ? <p className="text-sm text-amber-300">{err}</p> : null}
        <div className="grid gap-6 lg:grid-cols-3">
          {col("New", (s) => s === "PENDING")}
          {col("In progress", (s) => s === "ASSIGNED")}
          {col("Completed", (s) => s === "DONE")}
        </div>
      </div>
    </div>
  );
}
