"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { InternalSalesStage, InternalTechStage } from "@prisma/client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { readError, readPipelinePayload } from "@/components/internal-sales/internal-sales-read-api";
import type { LeadCard, PipelineCol } from "@/components/internal-sales/internal-sales-types";
import { techMetroLabel } from "@/lib/internal-sales-metro";

const TECH_ORDER: InternalTechStage[] = [
  InternalTechStage.ONBOARDING_RECEIVED,
  InternalTechStage.DATA_VERIFIED,
  InternalTechStage.DASHBOARD_SETUP,
  InternalTechStage.EMPLOYEE_SETUP,
  InternalTechStage.SYSTEM_TESTING,
  InternalTechStage.READY_FOR_DELIVERY,
];

function techIndex(s: InternalTechStage | null | undefined): number {
  if (!s) return 0;
  const i = TECH_ORDER.indexOf(s);
  return i >= 0 ? i : 0;
}

export function InternalTechWorkspace({ theme }: { theme: "bgos" | "ice" }) {
  const [pipeline, setPipeline] = useState<PipelineCol[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const shell =
    theme === "bgos"
      ? "min-h-screen px-4 pb-20 pt-6 text-white"
      : "min-h-screen bg-slate-50 px-4 pb-20 pt-6 text-slate-900";

  const card =
    theme === "bgos"
      ? "rounded-xl border border-white/10 bg-white/[0.04] p-4"
      : "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await apiFetch(`/api/internal-sales/leads?stage=${encodeURIComponent(InternalSalesStage.SENT_TO_TECH)}`,
        { credentials: "include" },
      );
      const j: unknown = await res.json();
      if (!res.ok) {
        setErr(readError(j, "Could not load tech queue."));
        setPipeline([]);
        return;
      }
      setPipeline(readPipelinePayload(j) ?? []);
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flat: LeadCard[] = [];
  for (const c of pipeline) for (const l of c.leads) flat.push(l);

  async function postTech(leadId: string, body: { action: "advance" | "handover_to_sales" }) {
    setBusyId(leadId);
    setErr(null);
    try {
      const res = await apiFetch(`/api/internal-sales/leads/${leadId}/tech-pipeline`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j: unknown = await res.json();
      if (!res.ok) {
        setErr(readError(j, "Update failed."));
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className={`${shell} flex items-center justify-center`}>
        <p className={theme === "bgos" ? "text-white/50" : "text-slate-500"}>Loading…</p>
      </div>
    );
  }

  return (
    <div className={shell}>
      <header className="mx-auto mb-6 flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Tech delivery</h1>
          <p className={theme === "bgos" ? "text-sm text-white/55" : "text-sm text-slate-500"}>
            Leads in Sent to Tech — advance each metro step, then hand over to sales.
          </p>
        </div>
        <Link
          href={theme === "bgos" ? "/bgos/internal-onboarding" : "/iceconnect/internal-onboarding"}
          className="text-sm font-medium text-indigo-400 underline"
        >
          Onboarding queue
        </Link>
      </header>

      {err ? (
        <div
          role="alert"
          className={
            theme === "bgos"
              ? "mx-auto mb-4 max-w-3xl rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100"
              : "mx-auto mb-4 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          }
        >
          {err}
        </div>
      ) : null}

      <ul className="mx-auto max-w-3xl space-y-4">
        {flat.map((l) => {
          const techStage = l.internalTechStage ?? null;
          const ti = techIndex(techStage);
          return (
            <li key={l.id} className={card}>
              <p className="font-semibold">{l.name}</p>
              <p className="text-sm opacity-80">{l.phone}</p>
              <div className="mt-3 flex flex-wrap gap-1 overflow-x-auto">
                {TECH_ORDER.map((step, idx) => {
                  const done = idx < ti;
                  const current = idx === ti;
                  const locked = idx > ti;
                  const base = "shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium sm:text-xs";
                  let cls = base;
                  if (done) {
                    cls +=
                      theme === "bgos"
                        ? " border-emerald-500/50 bg-emerald-500/15 text-emerald-100"
                        : " border-emerald-200 bg-emerald-50 text-emerald-900";
                  } else if (current) {
                    cls +=
                      theme === "bgos"
                        ? " border-amber-400/60 bg-amber-500/20 text-amber-100"
                        : " border-amber-300 bg-amber-50 text-amber-950";
                  } else {
                    cls +=
                      theme === "bgos"
                        ? " border-white/10 text-white/40 opacity-60"
                        : " border-slate-200 text-slate-400 opacity-70";
                  }
                  if (locked) cls += " pointer-events-none";
                  return (
                    <span key={step} className={cls} title={techMetroLabel(step)}>
                      {techMetroLabel(step)}
                    </span>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === l.id || techStage === InternalTechStage.READY_FOR_DELIVERY}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() => void postTech(l.id, { action: "advance" })}
                >
                  Complete stage
                </button>
                <button
                  type="button"
                  disabled={busyId === l.id || techStage !== InternalTechStage.READY_FOR_DELIVERY}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() => void postTech(l.id, { action: "handover_to_sales" })}
                >
                  Hand over to sales (Tech Ready)
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {flat.length === 0 ? (
        <p className={theme === "bgos" ? "py-12 text-center text-white/45" : "py-12 text-center text-slate-500"}>
          No leads in tech delivery right now.
        </p>
      ) : null}
    </div>
  );
}
