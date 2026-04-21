"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api-fetch";

type Lb = { name: string; progress: number; rank: number };
type Comp = {
  id: string;
  title: string;
  reward: string;
  target_value: number;
  ends_in_ms: number;
  leaderboard: Lb[];
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Ended";
  const h = Math.floor(ms / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  if (h >= 48) return `${Math.floor(h / 24)}d left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function NexaCompetitionsStrip() {
  const [comps, setComps] = useState<Comp[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/nexa/competitions", { credentials: "include" });
      const j = ((await readApiJson(res, "nexa-competitions")) ?? {}) as {
        ok?: boolean;
        competitions?: Comp[];
      };
      if (res.ok && j.ok === true && Array.isArray(j.competitions)) {
        setComps(j.competitions);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const c = comps[0];
  if (!c) return null;

  const top = c.leaderboard.slice(0, 3);
  const leadProg = top[0]?.progress ?? 0;
  const pct = c.target_value > 0 ? Math.min(100, (leadProg / c.target_value) * 100) : 0;

  return (
    <div className="rounded-2xl border border-violet-400/20 bg-violet-950/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/80">Live competition</p>
          <h3 className="mt-1 text-base font-semibold text-white">{c.title}</h3>
          <p className="mt-1 text-xs text-violet-200/70">{c.reward}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-medium text-white/70">
          {formatRemaining(c.ends_in_ms)}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
          style={{ width: `${Number.isFinite(pct) ? pct : 0}%` }}
        />
      </div>
      {top.length > 0 ? (
        <ol className="mt-4 space-y-1.5 text-xs text-white/80">
          {top.map((x) => (
            <li key={`${x.rank}-${x.name}`} className="flex justify-between gap-2">
              <span>
                #{x.rank} {x.name}
              </span>
              <span className="tabular-nums text-white/60">{x.progress.toFixed(0)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-xs text-white/45">Leaderboard updates as the team participates.</p>
      )}
    </div>
  );
}
