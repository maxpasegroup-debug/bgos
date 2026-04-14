"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { InternalCallStatus, InternalSalesStage } from "@prisma/client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readError,
  readPipelinePayload,
} from "@/components/internal-sales/internal-sales-read-api";
import type { LeadCard, PipelineCol } from "@/components/internal-sales/internal-sales-types";
import { InternalSalesMetroStrip } from "./InternalSalesMetroStrip";
import { NexaSupportModal } from "./NexaSupportModal";

function nextActionHint(l: LeadCard): string {
  if (l.callStatus === InternalCallStatus.NOT_CALLED) return "Next: make the first call";
  if (l.stage === InternalSalesStage.FOLLOW_UP) return "Next: follow up";
  if (l.stage === InternalSalesStage.DEMO_ORIENTATION) return "Next: demo / orientation";
  if (l.stage === InternalSalesStage.TECH_READY) return "Ready for delivery — hand off to client";
  return "Next: update pipeline";
}

export function InternalSalesRepMobile({ theme }: { theme: "bgos" | "ice" }) {
  const [pipeline, setPipeline] = useState<PipelineCol[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nexaForLead, setNexaForLead] = useState<string | null>(null);

  const shell =
    theme === "bgos"
      ? "min-h-screen bg-[#0B0F19] px-3 pb-24 pt-4 text-white"
      : "min-h-screen bg-slate-50 px-3 pb-24 pt-4 text-slate-900";

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/internal-sales/leads", { credentials: "include" });
      const j: unknown = await res.json();
      if (!res.ok) {
        setErr(readError(j, "Could not load."));
        return;
      }
      const pipe = readPipelinePayload(j);
      setPipeline(pipe ?? []);
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

  const flat = useMemo(() => {
    const rows: LeadCard[] = [];
    for (const c of pipeline) for (const l of c.leads) rows.push(l);
    rows.sort((a, b) => {
      const ta = a.nextFollowUpAt ? new Date(a.nextFollowUpAt).getTime() : Infinity;
      const tb = b.nextFollowUpAt ? new Date(b.nextFollowUpAt).getTime() : Infinity;
      return ta - tb;
    });
    return rows;
  }, [pipeline]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await apiFetch(`/api/internal-sales/leads/${id}`, {
        method: "PATCH",
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

  function quickCall(status: InternalCallStatus) {
    return (id: string) => void patch(id, { callStatus: status });
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
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">My calls</h1>
          <p className={theme === "bgos" ? "text-sm text-white/55" : "text-sm text-slate-500"}>
            Large buttons — tap after each call
          </p>
        </div>
        <Link
          href="/lead"
          className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
        >
          Add Lead
        </Link>
      </header>

      {err ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100"
        >
          {err}
        </div>
      ) : null}

      <ul className="space-y-4">
        {flat.map((l) => (
          <li
            key={l.id}
            className={
              theme === "bgos"
                ? "rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            }
          >
            <p className="text-lg font-semibold">{l.name}</p>
            <p className="text-sm tabular-nums opacity-80">{l.phone}</p>
            <p className="mt-2 text-sm font-medium text-amber-300/90">{nextActionHint(l)}</p>
            <div className="mt-2">
              <InternalSalesMetroStrip
                stage={l.stage}
                pendingBossApproval={l.pendingBossApproval}
                theme={theme}
                compact
              />
            </div>
            <label className="mt-3 block text-xs font-medium opacity-70">
              Next follow-up date
              <input
                type="datetime-local"
                className={
                  theme === "bgos"
                    ? "mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-3 text-base text-white"
                    : "mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
                }
                key={`${l.id}-${l.nextFollowUpAt ?? "x"}`}
                defaultValue={l.nextFollowUpAt ? l.nextFollowUpAt.slice(0, 16) : ""}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (!v) void patch(l.id, { nextFollowUpAt: null });
                  else void patch(l.id, { nextFollowUpAt: new Date(v).toISOString() });
                }}
              />
            </label>
            <p className="mt-2 text-xs opacity-60">Notes</p>
            <textarea
              className={
                theme === "bgos"
                  ? "mt-1 min-h-[72px] w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm"
                  : "mt-1 min-h-[72px] w-full rounded-xl border border-slate-200 p-3 text-sm"
              }
              defaultValue={l.notes ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (l.notes ?? "").trim()) void patch(l.id, { notes: v });
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === l.id}
                className="min-h-11 flex-1 rounded-xl bg-slate-500 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void patch(l.id, { advanceInternalSalesStage: true })}
              >
                Complete stage
              </button>
              <button
                type="button"
                disabled={busyId === l.id}
                className="min-h-11 flex-1 rounded-xl bg-cyan-600 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => setNexaForLead(l.id)}
              >
                Nexa Support
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busyId === l.id}
                className="min-h-14 rounded-xl bg-emerald-600 text-base font-semibold text-white disabled:opacity-50"
                onClick={() => quickCall(InternalCallStatus.CALLED)(l.id)}
              >
                Call done
              </button>
              <button
                type="button"
                disabled={busyId === l.id}
                className="min-h-14 rounded-xl bg-slate-600 text-base font-semibold text-white disabled:opacity-50"
                onClick={() => quickCall(InternalCallStatus.NO_ANSWER)(l.id)}
              >
                No answer
              </button>
              <button
                type="button"
                disabled={busyId === l.id}
                className="min-h-14 rounded-xl bg-indigo-600 text-base font-semibold text-white disabled:opacity-50"
                onClick={() => quickCall(InternalCallStatus.INTERESTED)(l.id)}
              >
                Interested
              </button>
              <button
                type="button"
                disabled={busyId === l.id}
                className="min-h-14 rounded-xl bg-rose-600 text-base font-semibold text-white disabled:opacity-50"
                onClick={() => quickCall(InternalCallStatus.NOT_INTERESTED)(l.id)}
              >
                Not interested
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] opacity-50">
              {l.stageLabel} · {l.callStatusLabel}
            </p>
          </li>
        ))}
      </ul>

      {flat.length === 0 ? (
        <p className={theme === "bgos" ? "py-12 text-center text-white/45" : "py-12 text-center text-slate-500"}>
          No leads assigned to you yet.
        </p>
      ) : null}

      {nexaForLead ? (
        <NexaSupportModal
          theme={theme}
          leadId={nexaForLead}
          onClose={() => setNexaForLead(null)}
          onDone={() => void load()}
        />
      ) : null}
    </div>
  );
}
