"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";

type WorkflowSubmission = {
  id: string;
  status: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "NEEDS_INFO" | "READY" | "DELIVERED";
  completionPercent: number;
  lead?: { id: string; name: string } | null;
};

function stageFromSubmission(s: WorkflowSubmission): "Setup" | "Config" | "Testing" | "Live" {
  if (s.status === "DELIVERED") return "Live";
  if (s.completionPercent >= 80 || s.status === "READY") return "Testing";
  if (s.completionPercent >= 40 || s.status === "IN_REVIEW") return "Config";
  return "Setup";
}

export default function IceconnectTechDashboardPage() {
  const [rows, setRows] = useState<WorkflowSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/onboarding/workflow/tech", { credentials: "include" });
        const j = ((await readApiJson(res, "iceconnect/tech-dashboard")) ?? {}) as {
          ok?: boolean;
          submissions?: WorkflowSubmission[];
          error?: string;
        };
        if (!res.ok || j.ok !== true || !Array.isArray(j.submissions)) {
          if (!cancelled) setError(j.error || "Could not load tech dashboard.");
          return;
        }
        if (!cancelled) {
          setRows(j.submissions);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(formatFetchFailure(e, "Could not load tech dashboard"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const out = {
      Setup: 0,
      Config: 0,
      Testing: 0,
      Live: 0,
    };
    for (const row of rows) out[stageFromSubmission(row)] += 1;
    return out;
  }, [rows]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Tech Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Assigned onboarding tasks and company setup pipeline.
        </p>
      </section>

      {error ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {error}
        </section>
      ) : null}

      <section id="onboarding-queue" className="grid gap-3 sm:grid-cols-4">
        {(["Setup", "Config", "Testing", "Live"] as const).map((stage) => (
          <div key={stage} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stage}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{grouped[stage]}</p>
          </div>
        ))}
      </section>

      <section id="my-tasks" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Assigned Onboarding Tasks</h2>
        <p className="mt-1 text-xs text-gray-500">Status flow: Setup → Config → Testing → Live</p>
        <ul className="mt-4 space-y-2">
          {rows.length === 0 ? (
            <li className="text-sm text-gray-500">No assigned tasks.</li>
          ) : (
            rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{row.lead?.name || "Onboarding task"}</p>
                  <p className="text-xs text-gray-500">Completion: {row.completionPercent}%</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {stageFromSubmission(row)}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section id="config" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Config</h2>
        <p className="mt-1 text-sm text-gray-600">Tasks in configuration or data mapping stage.</p>
      </section>

      <section id="testing" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Testing</h2>
        <p className="mt-1 text-sm text-gray-600">Tasks currently under validation and QA checks.</p>
      </section>

      <section id="completed" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Completed</h2>
        <p className="mt-1 text-sm text-gray-600">Delivered/live setups ready for handoff.</p>
      </section>
    </div>
  );
}
