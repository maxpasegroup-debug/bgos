"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api-fetch";
import { glassPanel, headingClass, bodyMutedClass } from "@/styles/design-system";

type DailyPlan = {
  tasks?: string[];
  insights?: string[];
  urgency_level?: string;
};

type BoardPayload = {
  ok?: boolean;
  work_board?: Record<string, unknown>;
  performance?: Record<string, unknown>;
  earnings?: { total_inr?: number };
};

export function EmployeeRoleDashboard({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [board, setBoard] = useState<BoardPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [pr, br] = await Promise.all([
        apiFetch("/api/nexa/daily-plan", { credentials: "include" }),
        apiFetch("/api/sales-network/dashboard", { credentials: "include" }),
      ]);
      const pj = (await readApiJson(pr, "daily-plan")) as DailyPlan & { ok?: boolean };
      const bj = (await readApiJson(br, "sales-dash")) as BoardPayload;
      if (pr.ok && pj.ok !== false) setPlan(pj);
      if (br.ok && bj.ok !== false) setBoard(bj);
      if (!pr.ok && !br.ok) setErr("Could not load dashboard data.");
    } catch {
      setErr("Could not load dashboard data.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className={bodyMutedClass}>{subtitle}</p>
          <h1 className={`${headingClass} mt-2`}>{title}</h1>
        </header>

        {err ? <p className="text-sm text-amber-300">{err}</p> : null}

        <section className={`${glassPanel} p-6`}>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">
            Today&apos;s Game Plan
          </h2>
          {plan?.urgency_level ? (
            <p className="mt-2 text-xs text-amber-200/90">Urgency: {plan.urgency_level}</p>
          ) : null}
          <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-white/90">
            {(plan?.tasks ?? []).slice(0, 8).map((t, i) => (
              <li key={`${i}-${t.slice(0, 24)}`}>{t}</li>
            ))}
            {(plan?.tasks ?? []).length === 0 ? (
              <li className="list-none text-white/50">Loading tasks from Nexa…</li>
            ) : null}
          </ul>
          <ul className="mt-4 space-y-1 text-sm text-slate-300">
            {(plan?.insights ?? []).slice(0, 6).map((t, i) => (
              <li key={`in-${i}`}>• {t}</li>
            ))}
          </ul>
        </section>

        <div className="grid gap-6 md:grid-cols-3">
          <section className={`${glassPanel} p-6`}>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">Work board</h2>
            <pre className="mt-3 max-h-48 overflow-auto text-xs text-slate-200">
              {JSON.stringify(board?.work_board ?? {}, null, 2)}
            </pre>
          </section>
          <section className={`${glassPanel} p-6`}>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">Performance</h2>
            <pre className="mt-3 max-h-48 overflow-auto text-xs text-slate-200">
              {JSON.stringify(board?.performance ?? {}, null, 2)}
            </pre>
          </section>
          <section className={`${glassPanel} p-6`}>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">Earnings</h2>
            <p className="mt-3 text-2xl font-semibold text-emerald-300">
              ₹{(board?.earnings?.total_inr ?? 0).toFixed(2)}
            </p>
            <p className={`mt-2 text-xs ${bodyMutedClass}`}>Hierarchy earnings (company scope)</p>
          </section>
        </div>

        <p className="text-center text-sm">
          <Link href="/iceconnect/sales" className="text-sky-400 underline">
            Open workspace
          </Link>
        </p>
      </div>
    </div>
  );
}
