"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBgosDashboardContext } from "./BgosDataProvider";
import { BGOS_MAIN_PAD } from "./layoutTokens";
import type { DashboardPayload } from "./useBgosData";
import type { DashboardAnalytics, DashboardAnalyticsTrendPoint } from "@/types";

const HOME_MAX_W = "mx-auto w-full max-w-[1200px]";
const SECTION_MB = "mb-8";

type PulseRangeKey = "today" | "this_month" | "3_months" | "1_year";

const PULSE_RANGES: { key: PulseRangeKey; label: string; api: string }[] = [
  { key: "today", label: "Today", api: "today" },
  { key: "this_month", label: "This month", api: "this_month" },
  { key: "3_months", label: "3 months", api: "3_months" },
  { key: "1_year", label: "Year", api: "1_year" },
];

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    n,
  );
}

async function fetchDashboardJson(range: string): Promise<DashboardPayload | null> {
  const res = await fetch(`/api/dashboard?range=${encodeURIComponent(range)}`, { credentials: "include" });
  if (!res.ok) return null;
  return (await res.json()) as DashboardPayload;
}

function PulseLineChart({ trend }: { trend: DashboardAnalyticsTrendPoint[] }) {
  const w = 560;
  const h = 180;
  const padX = 8;
  const padY = 28;
  const innerW = w - padX * 2;
  const innerH = h - padY - 12;

  const pts = trend.length ? trend : [{ label: "—", revenue: 0, leads: 0, expenses: 0 }];
  const vals = pts.map((p) => p.revenue);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;

  const coords = pts.map((p, i) => {
    const x = padX + (pts.length <= 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
    const y = padY + (1 - (p.revenue - min) / span) * innerH;
    return { x, y, revenue: p.revenue };
  });

  const segments: { d: string; pos: boolean }[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    segments.push({
      d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`,
      pos: b.revenue >= a.revenue,
    });
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-44 w-full max-h-52 text-emerald-400"
      preserveAspectRatio="xMidYMid meet"
      aria-label="Business overview chart"
    >
      {segments.map((s, i) => (
        <path
          key={i}
          d={s.d}
          fill="none"
          strokeWidth={2.25}
          strokeLinecap="round"
          stroke={s.pos ? "rgba(52, 211, 153, 0.95)" : "rgba(248, 113, 113, 0.95)"}
          className="transition-all duration-500 ease-out"
        />
      ))}
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3.5} fill="rgba(255,255,255,0.85)" className="drop-shadow-sm" />
      ))}
    </svg>
  );
}

export function BgosIntelligenceHome() {
  const { dashboard, hasProPlan, refetch } = useBgosDashboardContext();
  const [heroNexaLine, setHeroNexaLine] = useState<string | null>(null);

  const [pulseRange, setPulseRange] = useState<PulseRangeKey>("today");
  const [pulseLoading, setPulseLoading] = useState(true);
  const [pulseError, setPulseError] = useState<string | null>(null);
  const [pulseDash, setPulseDash] = useState<DashboardPayload | null>(null);

  const [growthRevenue, setGrowthRevenue] = useState("");
  const [growthLeads, setGrowthLeads] = useState("");
  const [growthSaving, setGrowthSaving] = useState(false);
  const [growthLoaded, setGrowthLoaded] = useState(false);

  const [nexaChat, setNexaChat] = useState("");
  const [nexaLog, setNexaLog] = useState<{ role: "you" | "nexa"; text: string }[]>([]);
  const [achievementOpen, setAchievementOpen] = useState(false);

  const revenuePotential = dashboard?.revenueBreakdown?.pipelineValue ?? 0;

  const fetchPulse = useCallback(async (key: PulseRangeKey) => {
    const api = PULSE_RANGES.find((r) => r.key === key)?.api ?? "today";
    setPulseLoading(true);
    setPulseError(null);
    const d = await fetchDashboardJson(api);
    setPulseLoading(false);
    if (!d) {
      setPulseError("Could not load numbers for this period.");
      setPulseDash(null);
      return;
    }
    setPulseDash(d);
  }, []);

  useEffect(() => {
    void fetchPulse(pulseRange);
  }, [fetchPulse, pulseRange]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await fetch("/api/bgos/growth-plan", { credentials: "include" });
        const j = (await res.json()) as {
          data?: { targetRevenueOneMonth?: number; targetLeadsOneMonth?: number };
          targetRevenueOneMonth?: number;
          targetLeadsOneMonth?: number;
        };
        if (c) return;
        const inner = j.data ?? j;
        const rev = inner.targetRevenueOneMonth ?? 0;
        const ld = inner.targetLeadsOneMonth ?? 0;
        setGrowthRevenue(rev > 0 ? String(rev) : "");
        setGrowthLeads(ld > 0 ? String(ld) : "");
        setGrowthLoaded(true);
      } catch {
        if (!c) setGrowthLoaded(true);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const pulseAnalytics: DashboardAnalytics | null = pulseDash?.analytics ?? null;

  const monthlyRunRate = dashboard?.financial?.monthlyRevenue ?? 0;
  const targetRevNum = Number.parseFloat(growthRevenue.replace(/,/g, "")) || 0;
  const targetLeadsNum = Number.parseInt(growthLeads.replace(/,/g, ""), 10) || 0;

  const yearOutlook = useMemo(() => {
    const projected = targetRevNum * 12;
    const base = Math.max(monthlyRunRate, 1);
    const growthPct = Math.round(((targetRevNum - base) / base) * 100);
    return { projected, growthPct };
  }, [targetRevNum, monthlyRunRate]);

  const threeYearCopy = useMemo(() => {
    const x = targetRevNum * 36;
    if (targetRevNum <= 0) return "Set your 1-month goal to see a simple 3-year picture.";
    return `At this pace, you can reach about ${formatInr(x)} in 3 years.`;
  }, [targetRevNum]);

  const salesDropHint = useMemo(() => {
    const t = pulseAnalytics?.trend ?? [];
    if (t.length < 2) return null;
    const mid = Math.floor(t.length / 2);
    const a = t.slice(0, mid).reduce((s, p) => s + p.revenue, 0) / mid || 0;
    const b =
      t.slice(mid).reduce((s, p) => s + p.revenue, 0) / Math.max(t.length - mid, 1) || 0;
    if (a <= 0) return null;
    const pct = Math.round(((b - a) / a) * 100);
    if (pct <= -5) return `Collections ran about ${Math.abs(pct)}% lower in the later part of this view.`;
    if (pct >= 5) return `Collections ran about ${pct}% higher in the later part of this view.`;
    return null;
  }, [pulseAnalytics?.trend]);

  const followUps = dashboard?.nexa?.pendingFollowUps ?? 0;

  async function saveGrowthPlan() {
    setGrowthSaving(true);
    try {
      await fetch("/api/bgos/growth-plan", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRevenueOneMonth: targetRevNum,
          targetLeadsOneMonth: targetLeadsNum,
        }),
      });
      void refetch();
    } finally {
      setGrowthSaving(false);
    }
  }

  function heroQuickAction(id: string) {
    const lines: Record<string, string> = {
      today:
        "Start with your hottest leads: open Sales and message anyone who visited in the last 48 hours.",
      priorities: "Top priorities: close one paid invoice, clear overdue tasks, and book two new site visits.",
      team: "Review the Team page — see who holds the most open leads and rebalance toward your best closers.",
      revenue: `Your open pipeline is about ${formatInr(revenuePotential)}. Pick the three biggest deals and add a follow-up date.`,
    };
    setHeroNexaLine(lines[id] ?? "Nexa is ready when you are.");
  }

  function nexaQuickAsk(q: string) {
    const staticReplies: Record<string, string> = {
      today:
        "Today: review new leads, send two follow-ups, and confirm one payment. Keep it small and repeatable.",
      why: "Revenue often dips when follow-ups slip or deals stall in negotiation — tighten those first.",
      performer: "Your best performer is usually whoever closes the most “site visit done” leads this month — compare on the Team page.",
      grow: "Grow faster by shortening response time, asking for referrals after every win, and raising your average ticket size.",
    };
    const key =
      q === "What should I do today?"
        ? "today"
        : q === "Why is revenue low?"
          ? "why"
          : q === "Who is best performer?"
            ? "performer"
    : "grow";
    setNexaLog((prev) => [...prev, { role: "you", text: q }, { role: "nexa", text: staticReplies[key] ?? "Let’s focus." }]);
  }

  function submitNexaChat() {
    const t = nexaChat.trim();
    if (!t) return;
    setNexaLog((prev) => [...prev, { role: "you", text: t }, { role: "nexa", text: "Here’s a quick take: tighten follow-ups, protect margin, and ship one win today. (Full Nexa chat is on the way.)" }]);
    setNexaChat("");
  }

  return (
    <div className={`${BGOS_MAIN_PAD} pb-16 pt-6`}>
      <div className={HOME_MAX_W}>
        {/* Hero + Nexa */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className={`${SECTION_MB} grid gap-6 lg:grid-cols-2 lg:gap-8`}
        >
          <div className="flex flex-col justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.07] via-white/[0.02] to-transparent px-6 py-8 sm:px-8 sm:py-10">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Welcome, Boss</h1>
            <p className="mt-3 text-base text-white/60 sm:text-lg">Let&apos;s grow your business today.</p>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-white/[0.1] bg-gradient-to-br from-[#0f1628] via-[#121a2e] to-[#0b0f19] px-6 py-6 shadow-[0_0_60px_-20px_rgba(255,195,0,0.15)] sm:px-7 sm:py-7">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFC300]/80">Nexa</p>
              <p className="mt-3 text-lg font-medium leading-relaxed text-white/90">
                You have {formatInr(revenuePotential)} opportunity in your pipeline today.
              </p>
              {heroNexaLine ? (
                <p className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/75">
                  {heroNexaLine}
                </p>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {(
                [
                  ["today", "What should I do today?"],
                  ["priorities", "Show my top priorities"],
                  ["team", "Review my team"],
                  ["revenue", "Check revenue"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => heroQuickAction(id)}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-left text-xs font-medium text-white/80 transition hover:border-[#FFC300]/30 hover:bg-white/[0.08] sm:text-sm"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Live Business Pulse */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className={`${SECTION_MB} rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-6 sm:px-7 sm:py-7`}
        >
          <h2 className="text-lg font-semibold tracking-tight text-white">Live business pulse</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {PULSE_RANGES.map((r) => {
              const locked = !hasProPlan && (r.key === "3_months" || r.key === "1_year");
              return (
                <button
                  key={r.key}
                  type="button"
                  disabled={locked}
                  title={locked ? "Upgrade for longer ranges" : undefined}
                  onClick={() => {
                    if (!locked) setPulseRange(r.key);
                  }}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                    pulseRange === r.key
                      ? "bg-[#FFC300]/20 text-[#FFE08A] ring-1 ring-[#FFC300]/35"
                      : locked
                        ? "cursor-not-allowed opacity-40"
                        : "bg-white/[0.06] text-white/70 hover:bg-white/[0.1]"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          {pulseError ? (
            <p className="mt-3 text-sm text-red-300/90">{pulseError}</p>
          ) : null}
          {pulseLoading && !pulseAnalytics ? (
            <div className="mt-6 h-40 animate-pulse rounded-xl bg-white/[0.06]" />
          ) : pulseAnalytics ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    ["Revenue", formatInr(pulseAnalytics.revenue)],
                    ["Leads", String(pulseAnalytics.leads)],
                    ["Sales success", `${pulseAnalytics.conversionPercent}%`],
                    ["Collections", formatInr(pulseAnalytics.revenue)],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{label}</p>
                    <p className="mt-2 text-xl font-semibold tabular-nums text-white sm:text-2xl">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-4">
                {pulseAnalytics.trend.length === 0 ? (
                  <p className="py-8 text-center text-sm text-white/45">No points in this range yet.</p>
                ) : (
                  <PulseLineChart trend={pulseAnalytics.trend} />
                )}
              </div>
            </>
          ) : null}
        </motion.section>

        {/* Business plan */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className={`${SECTION_MB} grid gap-6 lg:grid-cols-3`}
        >
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 lg:col-span-1">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FFC300]/85">Your business plan</h2>
            <p className="mt-4 text-sm font-medium text-white/80">1 month goal</p>
            <label className="mt-3 block">
              <span className="text-[11px] text-white/45">Target revenue (₹)</span>
              <input
                type="text"
                inputMode="decimal"
                value={growthRevenue}
                onChange={(e) => setGrowthRevenue(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#FFC300]/35"
                placeholder="e.g. 500000"
                disabled={!growthLoaded}
              />
            </label>
            <label className="mt-4 block">
              <span className="text-[11px] text-white/45">Target leads</span>
              <input
                type="text"
                inputMode="numeric"
                value={growthLeads}
                onChange={(e) => setGrowthLeads(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#FFC300]/35"
                placeholder="e.g. 40"
                disabled={!growthLoaded}
              />
            </label>
            <button
              type="button"
              disabled={growthSaving || !growthLoaded}
              onClick={() => void saveGrowthPlan()}
              className="mt-5 w-full rounded-xl bg-[#FFC300]/90 py-2.5 text-sm font-semibold text-black transition hover:bg-[#FFC300] disabled:opacity-50"
            >
              {growthSaving ? "Saving…" : "Save"}
            </button>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <p className="text-sm font-medium text-white/80">1 year outlook</p>
            <p className="mt-4 text-2xl font-semibold tabular-nums text-white">{formatInr(yearOutlook.projected)}</p>
            <p className="mt-1 text-xs text-white/45">Projected revenue (12× your monthly target)</p>
            <p className="mt-6 text-sm text-white/55">
              Growth vs this month&apos;s run rate:{" "}
              <span className="font-semibold text-white/90">
                {yearOutlook.growthPct > 0 ? "+" : ""}
                {yearOutlook.growthPct}%
              </span>
            </p>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <div>
              <p className="text-sm font-medium text-white/80">3–5 year vision</p>
              <p className="mt-4 text-sm leading-relaxed text-white/70">{threeYearCopy}</p>
            </div>
            <button
              type="button"
              onClick={() => setAchievementOpen(true)}
              className="mt-6 rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 py-2.5 text-sm font-semibold text-[#FFE08A] transition hover:bg-[#FFC300]/16"
            >
              How to achieve this?
            </button>
          </div>
        </motion.section>

        {/* Nexa Intelligence */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
          className={`${SECTION_MB} rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-7`}
        >
          <h2 className="text-lg font-semibold tracking-tight text-white">Nexa insights</h2>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Insights</p>
              <ul className="mt-3 space-y-2 text-sm text-white/75">
                {salesDropHint ? <li className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">{salesDropHint}</li> : null}
                <li className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                  {followUps > 0
                    ? `${followUps} follow-up${followUps === 1 ? "" : "s"} waiting for you.`
                    : "No follow-ups queued — nice and clean."}
                </li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Suggestions</p>
              <ul className="mt-3 space-y-2 text-sm text-white/75">
                <li className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">Focus on your top leads first.</li>
                <li className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">Reassign tasks if someone is overloaded.</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/bgos/sales"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-100/95 transition hover:bg-emerald-500/15"
            >
              Fix now
            </Link>
            <Link
              href="/bgos/nexa"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] px-4 text-sm font-semibold text-white/85 transition hover:bg-white/[0.09]"
            >
              Let Nexa handle
            </Link>
          </div>

          <div className="mt-8 rounded-xl border border-white/[0.08] bg-black/20 p-4">
            <div className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {nexaLog.length === 0 ? (
                <p className="text-white/40">Ask a question to get started.</p>
              ) : (
                nexaLog.map((m, i) => (
                  <p key={i} className={m.role === "nexa" ? "text-[#FFC300]/90" : "text-white/80"}>
                    <span className="font-semibold text-white/50">{m.role === "nexa" ? "Nexa: " : "You: "}</span>
                    {m.text}
                  </p>
                ))
              )}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={nexaChat}
                onChange={(e) => setNexaChat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitNexaChat()}
                placeholder="Ask Nexa anything…"
                className="min-h-[44px] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#FFC300]/35"
              />
              <button
                type="button"
                onClick={submitNexaChat}
                className="min-h-[44px] rounded-xl bg-[#FFC300]/85 px-4 text-sm font-semibold text-black"
              >
                Send
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "What should I do today?",
              "Why is revenue low?",
              "Who is best performer?",
              "How to grow faster?",
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => nexaQuickAsk(q)}
                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/75 hover:border-[#FFC300]/25"
              >
                {q}
              </button>
            ))}
          </div>
        </motion.section>

      </div>

      {achievementOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0f141c] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">How to achieve this</h3>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-white/70">
              <li>Book one extra customer visit per week.</li>
              <li>Ask for referrals after every closed deal.</li>
              <li>Cut response time to new leads to under 1 hour.</li>
              <li>Protect margin — don&apos;t discount without a trade.</li>
            </ul>
            <button
              type="button"
              onClick={() => setAchievementOpen(false)}
              className="mt-6 w-full rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
