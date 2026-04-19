"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api-fetch";

type NexaMsg = {
  kind: string;
  text: string;
  parts?: { context: string; insight: string; action: string };
};

type PersuasionPayload = {
  version?: string;
  time_band?: string;
  timing_hint?: string;
  progress?: { display?: string } | null;
  urgency?: string | null;
  loss_aversion?: string | null;
  social_proof?: string | null;
  micro_win?: string | null;
  streak?: { activity_days?: number; sales_days?: number; line?: string | null };
  reward_anticipation?: string | null;
  smart_nudge?: string | null;
  role_focus?: string | null;
  addiction_loop?: string;
};

type DailyPlan = {
  ok?: boolean;
  tasks?: string[];
  insights?: string[];
  urgency_level?: string;
  tone_profile?: string;
  nexa_messages?: NexaMsg[];
  persuasion?: PersuasionPayload;
  error?: string;
};

const urgencyStyles: Record<string, string> = {
  calm: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100/95",
  normal: "border-white/10 bg-white/[0.04] text-white/85",
  high: "border-amber-400/30 bg-amber-500/10 text-amber-100/95",
  critical: "border-rose-400/35 bg-rose-500/15 text-rose-100/95",
};

export function NexaTodaysGamePlan() {
  const [data, setData] = useState<DailyPlan | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/nexa/daily-plan", { credentials: "include" });
      const j = ((await readApiJson(res, "nexa-daily-plan")) ?? {}) as DailyPlan;
      if (!res.ok || j.ok === false) {
        setErr(typeof j.error === "string" ? j.error : "Plan unavailable");
        return;
      }
      setData(j);
    } catch {
      setErr("Could not load today’s plan");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-200/90">
        {err}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
        Loading today’s game plan…
      </div>
    );
  }

  const u = data.urgency_level ?? "normal";
  const ring = urgencyStyles[u] ?? urgencyStyles.normal;
  const p = data.persuasion;

  return (
    <div className={`rounded-2xl border p-5 shadow-lg ${ring}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Nexa</p>
        <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
          {u}
        </span>
      </div>
      <h3 className="mt-2 text-lg font-semibold text-white">Today&apos;s Game Plan</h3>
      {p?.progress?.display ? (
        <p className="mt-3 rounded-xl border border-indigo-400/20 bg-indigo-950/30 px-3 py-2 text-sm text-indigo-100/95">
          {p.progress.display}
        </p>
      ) : null}
      {p?.time_band ? (
        <p className="mt-2 text-xs text-white/55">
          <span className="font-semibold uppercase tracking-wide text-white/40">{p.time_band}</span>
          {p.timing_hint ? ` · ${p.timing_hint}` : null}
        </p>
      ) : null}
      {p?.streak &&
      (p.streak.line ||
        (p.streak.activity_days ?? 0) >= 2 ||
        (p.streak.sales_days ?? 0) >= 2) ? (
        <p className="mt-2 text-xs text-amber-100/90">
          {p.streak.line ??
            `Activity streak: ${p.streak.activity_days ?? 0}d. Sales streak: ${p.streak.sales_days ?? 0}d.`}
        </p>
      ) : null}
      {p?.micro_win ? (
        <p className="mt-2 text-xs font-medium text-emerald-200/90">{p.micro_win}</p>
      ) : null}
      {[p?.urgency, p?.loss_aversion, p?.social_proof, p?.reward_anticipation, p?.smart_nudge, p?.role_focus]
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .slice(0, 5)
        .map((line) => (
          <p key={line.slice(0, 48)} className="mt-2 text-xs text-white/75">
            {line}
          </p>
        ))}
      {p?.addiction_loop ? (
        <p className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/55">
          {p.addiction_loop}
        </p>
      ) : null}
      {data.tone_profile ? (
        <p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">
          {data.tone_profile} tone
        </p>
      ) : null}
      {(data.nexa_messages ?? []).length > 0 ? (
        <ul className="mt-4 space-y-3">
          {(data.nexa_messages ?? []).slice(0, 5).map((m) => (
            <li
              key={`${m.kind}-${m.text.slice(0, 24)}`}
              className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-xs text-white/80"
            >
              <span className="font-semibold uppercase tracking-wide text-white/45">{m.kind}</span>
              {m.parts ? (
                <dl className="mt-2 space-y-1.5">
                  <div>
                    <dt className="text-[10px] text-white/35">Context</dt>
                    <dd className="text-sm text-white/90">{m.parts.context}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-white/35">Insight</dt>
                    <dd className="text-sm text-white/90">{m.parts.insight}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-white/35">Action</dt>
                    <dd className="text-sm text-white/90">{m.parts.action}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-1 text-sm text-white/85">{m.text}</p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-4 space-y-2">
        {(data.tasks ?? []).slice(0, 5).map((t) => (
          <li key={t} className="flex gap-2 text-sm text-white/90">
            <span className="text-indigo-300" aria-hidden>
              ▸
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
      {(data.nexa_messages ?? []).length === 0 && (data.insights ?? []).length > 0 ? (
        <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-xs text-white/70">
          {(data.insights ?? []).slice(0, 4).map((i) => (
            <li key={i}>• {i}</li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={() => void load()}
        className="mt-4 text-xs font-semibold text-indigo-300 hover:text-indigo-200"
      >
        Refresh plan
      </button>
    </div>
  );
}
