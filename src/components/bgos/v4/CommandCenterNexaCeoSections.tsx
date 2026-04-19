"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api-fetch";
import { NexaAnnouncementsStrip } from "@/components/bgos/nexa/NexaAnnouncementsStrip";
import { NexaCompetitionsStrip } from "@/components/bgos/nexa/NexaCompetitionsStrip";
import { NexaTodaysGamePlan } from "@/components/bgos/nexa/NexaTodaysGamePlan";
import { glassPanel, bodyMutedClass } from "@/styles/design-system";

type CeoInsights = {
  ok?: boolean;
  weak_regions?: { region: string; note: string }[];
  top_performers?: { name: string; points: number; note?: string }[];
  nexa_says?: string[];
  alerts?: string[];
  revenue_trend_7d_inr?: number;
};

export function CommandCenterNexaCeoSections() {
  const [ceo, setCeo] = useState<CeoInsights | null>(null);
  const [ceoErr, setCeoErr] = useState<string | null>(null);
  const [ceoLoading, setCeoLoading] = useState(true);

  const loadCeo = useCallback(async () => {
    setCeoErr(null);
    setCeoLoading(true);
    try {
      const res = await apiFetch("/api/nexa/ceo-insights", { credentials: "include" });
      const j = ((await readApiJson(res, "nexa-ceo-insights")) ?? {}) as CeoInsights & { error?: string };
      if (!res.ok || j.ok === false) {
        if (res.status === 403 || res.status === 401) {
          setCeo(null);
          return;
        }
        setCeoErr(typeof j.error === "string" ? j.error : "Insights unavailable");
        return;
      }
      setCeo(j);
    } catch {
      setCeoErr(null);
      setCeo(null);
    } finally {
      setCeoLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCeo();
  }, [loadCeo]);

  return (
    <div className="space-y-8">
      <section className={`${glassPanel} p-6 md:p-8`}>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-white/80">Nexa CEO insights</h2>
        {ceoErr ? <p className="mt-3 text-sm text-amber-400/90">{ceoErr}</p> : null}
        {ceoLoading ? <p className={`mt-4 text-sm ${bodyMutedClass}`}>Loading executive signals…</p> : null}
        {!ceoLoading && !ceo && !ceoErr ? (
          <p className={`mt-4 text-sm ${bodyMutedClass}`}>Sign in as platform boss to unlock CEO insights.</p>
        ) : null}
        {ceo?.revenue_trend_7d_inr != null ? (
          <p className="mt-4 text-sm text-white/80">
            7-day revenue signal: ₹{ceo.revenue_trend_7d_inr.toLocaleString("en-IN")} (platform-wide)
          </p>
        ) : null}
        {ceo?.nexa_says && ceo.nexa_says.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-[#E8FBFF]/90">
            {ceo.nexa_says.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        ) : null}
        {ceo?.weak_regions && ceo.weak_regions.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">Weak regions</p>
            <ul className="mt-2 space-y-1">
              {ceo.weak_regions.map((w) => (
                <li key={w.region}>{w.note}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {ceo?.top_performers && ceo.top_performers.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Top performers</p>
            <ul className="mt-2 space-y-1 text-sm text-white/85">
              {ceo.top_performers.slice(0, 5).map((t) => (
                <li key={t.name}>
                  {t.name} — {t.points} pts
                  {t.note ? <span className="text-white/50"> · {t.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void loadCeo()}
          className="mt-4 text-xs font-semibold text-[#4FD1FF] hover:underline"
        >
          Refresh insights
        </button>
      </section>

      <section className={`${glassPanel} p-6 md:p-8`}>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-white/80">CEO control</h2>
        <p className={`mt-2 text-sm ${bodyMutedClass}`}>
          Jump to execution — competitions and announcements also work from your tenant workspace.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/bgos/control/sales"
            className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 no-underline"
          >
            Launch competition
          </Link>
          <Link
            href="/bgos/boss/home"
            className="rounded-2xl border border-[#4FD1FF]/25 bg-[#4FD1FF]/10 px-4 py-2 text-xs font-semibold text-[#4FD1FF] no-underline"
          >
            Send announcement
          </Link>
          <Link
            href="/bgos/control/hr"
            className="rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-200 no-underline"
          >
            Promote employee
          </Link>
          <Link
            href="/sales-booster"
            className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-100 no-underline"
          >
            Trigger campaign
          </Link>
        </div>
      </section>

      <NexaAnnouncementsStrip />

      <div className="grid gap-4 lg:grid-cols-2">
        <NexaTodaysGamePlan />
        <NexaCompetitionsStrip />
      </div>
    </div>
  );
}
