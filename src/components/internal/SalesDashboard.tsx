"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { SalesNetworkRole } from "@prisma/client";
import { apiFetch } from "@/lib/api-fetch";
import { useInternalSession } from "./InternalSessionContext";
import { glassPanel, glassPanelHover, ds } from "@/styles/design-system";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tracker = {
  role: string;
  totalPoints: number;
  activeSubscriptions: number;
  currentLevel: string;
  promotionEligible: boolean;
  roleTarget: string | null;
  progressHints: { nextRole?: string; progressPercent?: number; subsNeeded?: number; requiredActiveSubs?: number; currentActiveSubs?: number; requirement?: string };
  bdmRecurring: { tier: string; monthlyAmount: number } | null;
};

type EarningRow = { id: string; amount: number; type: string; createdAt: string; subscriptionId: string | null; sourceUserId: string | null };

type SubRow = { id: string; planType: string; points: number; status: string; isActive: boolean; startedAt: string; ownerName: string };

type TeamMember = { userId: string; name: string; email: string; salesNetworkRole: string | null; totalPoints: number; activeSubscriptions: number; promotionProgress: { progressPercent?: number; subsNeeded?: number } | null; bdmRecurring: { tier: string; monthlyAmount: number } | null };

type MonthlyPoint = { month: string; total: number; direct: number; override: number; recurring: number };

type Earnings = { totalAmount: number; totalCount: number; monthly: { totalEarnings: number; activeSubs: number; monthlyBreakdown: MonthlyPoint[] } };

type NexaMsg = { type: "task_reminder" | "performance" | "urgency" | "recognition"; text: string; cta: string; priority: number };
type NexaData = { messages: NexaMsg[]; extraTasks: string[]; urgencyLevel: "calm" | "normal" | "high" | "critical"; inactivityDays: number };

const PLAN = { BASIC: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" }, PRO: { color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" }, CUSTOM: { color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" } };

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function fadeUp(i = 0) {
  return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay: i * 0.06 } };
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className={`${glassPanel} p-5`}>
      <p className="text-xs font-medium uppercase tracking-widest text-white/40">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-white/30">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ pct, color = "from-[#4FD1FF] to-[#7C5CFF]", label }: { pct: number; color?: string; label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <div className="flex justify-between text-xs text-white/40"><span>{label}</span><span>{pct}%</span></div>}
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan badge
// ---------------------------------------------------------------------------

function PlanBadge({ plan }: { plan: string }) {
  const p = PLAN[plan as keyof typeof PLAN] ?? { color: "text-white/50", bg: "bg-white/5 border-white/10" };
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${p.bg} ${p.color}`}>{plan}</span>;
}

// ---------------------------------------------------------------------------
// SECTION: Nexa Today Panel
// ---------------------------------------------------------------------------

const NEXA_MSG_STYLES: Record<NexaMsg["type"], { border: string; bg: string; dot: string; badge: string; badgeText: string }> = {
  urgency:      { border: "border-[#4FD1FF]/30", bg: "bg-[#4FD1FF]/8",   dot: "bg-[#4FD1FF]",   badge: "bg-[#4FD1FF]/15 border-[#4FD1FF]/25",  badgeText: "text-[#4FD1FF]"   },
  task_reminder:{ border: "border-amber-500/30",  bg: "bg-amber-500/8",   dot: "bg-amber-400",   badge: "bg-amber-500/15 border-amber-500/25",   badgeText: "text-amber-400"   },
  performance:  { border: "border-orange-500/30", bg: "bg-orange-500/8",  dot: "bg-orange-400",  badge: "bg-orange-500/15 border-orange-500/25",  badgeText: "text-orange-400"  },
  recognition:  { border: "border-emerald-500/30",bg: "bg-emerald-500/8", dot: "bg-emerald-400", badge: "bg-emerald-500/15 border-emerald-500/25", badgeText: "text-emerald-400" },
};

const NEXA_MSG_LABEL: Record<NexaMsg["type"], string> = {
  urgency: "Urgent", task_reminder: "Reminder", performance: "Action", recognition: "On track",
};

function NexaTodayPanel({ tracker, nexa }: { tracker: Tracker | null; nexa: NexaData | null }) {
  const { salesNetworkRole } = useInternalSession();

  const hasMessages = (nexa?.messages?.length ?? 0) > 0;

  // Fallback static tips when Nexa has nothing to say
  const fallbackTips = [
    "Aim for 3 demos today — consistent outreach compounds.",
    "Follow up on prospects contacted 2+ days ago.",
    "Update your pipeline after every call.",
  ];

  return (
    <div className={`${glassPanel} p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Nexa Today</p>
          <h2 className="mt-1 text-lg font-bold text-white">
            {salesNetworkRole === SalesNetworkRole.BDE ? "Your daily mission" : "Team briefing"}
          </h2>
        </div>
        <span className="shrink-0 rounded-xl bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400">
          {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
        </span>
      </div>

      {/* Proactive Nexa messages */}
      {hasMessages ? (
        <ul className="mt-4 space-y-2.5">
          {nexa!.messages.map((msg, i) => {
            const s = NEXA_MSG_STYLES[msg.type];
            return (
              <li key={i} className={`flex items-start gap-3 rounded-xl border ${s.border} ${s.bg} px-4 py-3`}>
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug text-white">{msg.text}</p>
                </div>
                <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.badge} ${s.badgeText}`}>
                  {NEXA_MSG_LABEL[msg.type]}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {fallbackTips.map((t, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4FD1FF]" />
              <p className="text-sm text-white/60">{t}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Extra tasks (performance low) */}
      {(nexa?.extraTasks?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">Today&apos;s Tasks</p>
          <ul className="space-y-1.5">
            {nexa!.extraTasks.map((task, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-orange-400/60" />
                <p className="text-xs text-white/60">{task}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {salesNetworkRole === SalesNetworkRole.BDE && (
        <>
          {/* Next scratch card hint */}
          {tracker && (() => {
            const pts = Math.round(tracker.totalPoints / 10);
            const milestones = [10, 20];
            const next = milestones.find((m) => pts < m);
            if (!next) return null;
            const pct = Math.min(100, Math.round((pts / next) * 100));
            return (
              <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Next scratch card</span>
                  <span className="text-amber-400 font-semibold">{pts} / {next} pts</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-white/30">{next - pts} pts to unlock 🎁</p>
              </div>
            );
          })()}

          <div className="mt-4 flex gap-3">
            <Link href="/internal/onboard-company" className="flex-1 rounded-xl bg-[#4FD1FF]/10 border border-[#4FD1FF]/20 px-4 py-2.5 text-center text-sm font-medium text-[#4FD1FF] hover:bg-[#4FD1FF]/20 transition-colors">
              + Add Company
            </Link>
            <Link href="/internal/onboard-company?existing=1" className="flex-1 rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2.5 text-center text-sm font-medium text-white/60 hover:bg-white/[0.07] transition-colors">
              Onboard Existing
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SECTION: Progress Tracker
// ---------------------------------------------------------------------------

function ProgressTracker({ tracker }: { tracker: Tracker | null }) {
  if (!tracker) {
    return (
      <div className={`${glassPanel} p-6 animate-pulse`}>
        <div className="h-4 w-32 rounded bg-white/10" />
        <div className="mt-4 space-y-3">
          <div className="h-3 rounded bg-white/10" />
          <div className="h-3 w-3/4 rounded bg-white/10" />
        </div>
      </div>
    );
  }

  const { progressHints, activeSubscriptions, totalPoints, promotionEligible, bdmRecurring } = tracker;
  const pct = progressHints?.progressPercent ?? 0;
  const TARGET_INR = 30000;
  const estimatedEarnings = activeSubscriptions * 1500;
  const earningsPct = Math.min(100, Math.round((estimatedEarnings / TARGET_INR) * 100));

  const milestonePoints = [0, 20, 60];
  const displayPts = Math.round(totalPoints / 10);

  return (
    <div className={`${glassPanel} p-6 space-y-6`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Progress</p>
        <h3 className="mt-1 text-base font-bold text-white">Your Journey</h3>
      </div>

      {/* Monthly target */}
      <div className="space-y-3">
        <div className="flex justify-between text-xs">
          <span className="text-white/50">Monthly Target</span>
          <span className="font-semibold text-white">{fmt(TARGET_INR)}</span>
        </div>
        <ProgressBar pct={earningsPct} />
        <p className="text-xs text-white/30">{activeSubscriptions} active subs · est. {fmt(estimatedEarnings)}</p>
      </div>

      {/* Milestone dots */}
      <div className="space-y-2">
        <p className="text-xs text-white/40">Points Milestones</p>
        <div className="flex items-center gap-0">
          {milestonePoints.map((m, i) => {
            const reached = displayPts >= m;
            return (
              <div key={m} className="flex items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all ${reached ? "border-[#4FD1FF] bg-[#4FD1FF]/20 text-[#4FD1FF]" : "border-white/20 text-white/30"}`}>
                  {m}
                </div>
                {i < milestonePoints.length - 1 && (
                  <div className={`h-px flex-1 w-12 ${displayPts > m ? "bg-[#4FD1FF]" : "bg-white/10"}`} />
                )}
              </div>
            );
          })}
          <p className="ml-4 text-sm font-semibold text-white">{displayPts} pts</p>
        </div>
      </div>

      {/* BDE→BDM */}
      {progressHints?.nextRole && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 space-y-3">
          <div className="flex justify-between text-xs">
            <span className="text-white/50">Path to {progressHints.nextRole}</span>
            <span className="text-white/70 font-medium">{activeSubscriptions} / {progressHints.requiredActiveSubs ?? 60} subs</span>
          </div>
          <ProgressBar pct={pct} color="from-emerald-500 to-cyan-500" />
          {(progressHints.subsNeeded ?? 0) > 0 && (
            <p className="text-xs text-white/40">{progressHints.subsNeeded} more active subs to reach {progressHints.nextRole}</p>
          )}
        </div>
      )}

      {/* BDM recurring */}
      {bdmRecurring && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
          <p className="text-xs font-semibold text-cyan-400">Recurring Tier: {bdmRecurring.tier}</p>
          <p className="text-sm font-bold text-white mt-0.5">{fmt(bdmRecurring.monthlyAmount)}/month</p>
        </div>
      )}

      {promotionEligible && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-amber-400">🚀 Promotion eligible!</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SECTION: Subscriptions (Leads Panel)
// ---------------------------------------------------------------------------

function SubscriptionsPanel({ subs, total }: { subs: SubRow[]; total: number }) {
  const statusBadge: Record<string, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    CANCELLED: "bg-red-500/15 text-red-400 border-red-500/25",
  };

  if (subs.length === 0) {
    return (
      <div className={`${glassPanel} p-6`}>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Subscriptions</p>
        <div className="mt-6 flex flex-col items-center gap-2 py-8 text-white/30">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth={1.5} d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          <p className="text-sm">No subscriptions yet</p>
          <Link href="/internal/onboard-company" className="mt-2 text-sm font-medium text-[#4FD1FF] hover:underline">Add your first company →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`${glassPanel} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
        <p className="text-sm font-semibold text-white">Subscriptions <span className="ml-2 rounded-full bg-white/[0.08] px-2 py-0.5 text-xs text-white/50">{subs.length}{total > subs.length ? ` / ${total}` : ""}</span></p>
        <Link href="/internal/onboard-company" className="rounded-lg bg-[#4FD1FF]/10 px-3 py-1.5 text-xs font-medium text-[#4FD1FF] hover:bg-[#4FD1FF]/20 transition-colors">+ Add</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.05] text-left">
              <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Owner</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Plan</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Points</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Status</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Started</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s, i) => (
              <tr key={s.id} className={`border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors ${i % 2 === 0 ? "" : ""}`}>
                <td className="px-6 py-3.5 font-medium text-white/80">{s.ownerName}</td>
                <td className="px-4 py-3.5"><PlanBadge plan={s.planType} /></td>
                <td className="px-4 py-3.5 text-white/60">{Math.round(s.points / 10)}</td>
                <td className="px-4 py-3.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge[s.status] ?? "text-white/40"}`}>
                    {s.isActive ? "Active" : s.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-white/40 text-xs">
                  {new Date(s.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SECTION: Team panel (BDM/RSM/BOSS)
// ---------------------------------------------------------------------------

function TeamPanel({
  team,
  total,
  onLoadMore,
  loadingMore,
}: {
  team: TeamMember[];
  total: number;
  onLoadMore: () => void;
  loadingMore: boolean;
}) {
  const roleColors: Record<string, string> = {
    BDE:       "bg-emerald-500/15 text-emerald-400",
    BDM:       "bg-cyan-500/15 text-cyan-400",
    RSM:       "bg-violet-500/15 text-violet-400",
    BOSS:      "bg-amber-500/15 text-amber-400",
    TECH_EXEC: "bg-sky-500/15 text-sky-400",
  };

  const hasMore = team.length < total;

  return (
    <div className={`${glassPanel} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
        <p className="text-sm font-semibold text-white">
          Team
          <span className="ml-2 rounded-full bg-white/[0.08] px-2 py-0.5 text-xs text-white/50">
            {team.length}{total > team.length ? ` / ${total}` : ""}
          </span>
        </p>
        <Link href="/internal/team" className="text-xs text-white/40 hover:text-white/70 transition-colors">
          View all →
        </Link>
      </div>
      <ul className="divide-y divide-white/[0.05]">
        {team.map((m) => {
          const roleKey = m.salesNetworkRole ?? "BDE";
          return (
            <li key={m.userId} className="flex items-center gap-3 px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-xs font-bold text-white/70">
                {m.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white/80">{m.name}</p>
                <p className="text-xs text-white/30">{m.activeSubscriptions} active subs · {Math.round(m.totalPoints / 10)} pts</p>
              </div>
              {m.promotionProgress && (
                <div className="w-20">
                  <ProgressBar pct={m.promotionProgress.progressPercent ?? 0} />
                </div>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleColors[roleKey] ?? "bg-white/10 text-white/50"}`}>
                {roleKey}
              </span>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <div className="border-t border-white/[0.06] px-6 py-3">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="w-full rounded-xl bg-white/[0.03] border border-white/[0.07] py-2 text-xs font-medium text-white/40 hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-40 transition-all"
          >
            {loadingMore ? "Loading…" : `Load more (${total - team.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SECTION: Wallet summary (inline)
// ---------------------------------------------------------------------------

function WalletSummary({ earnings }: { earnings: Earnings | null }) {
  const total = earnings?.totalAmount ?? 0;
  const monthly = earnings?.monthly?.totalEarnings ?? 0;
  const activeSubs = earnings?.monthly?.activeSubs ?? 0;

  return (
    <div className={`${glassPanel} p-6`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Wallet Summary</p>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-white/40">Total Earned</p>
          <p className="mt-1 text-lg font-bold text-white">{fmt(total)}</p>
        </div>
        <div>
          <p className="text-xs text-white/40">This Period</p>
          <p className="mt-1 text-lg font-bold text-emerald-400">{fmt(monthly)}</p>
        </div>
        <div>
          <p className="text-xs text-white/40">Active Subs</p>
          <p className="mt-1 text-lg font-bold text-[#4FD1FF]">{activeSubs}</p>
        </div>
      </div>
      <div className="mt-4">
        <Link href="/internal/wallet" className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors">
          View full wallet →
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard (role-aware)
// ---------------------------------------------------------------------------

export function SalesDashboard() {
  const { salesNetworkRole } = useInternalSession();

  const [tracker, setTracker]           = useState<Tracker | null>(null);
  const [earnings, setEarnings]           = useState<Earnings | null>(null);
  const [subs, setSubs]                   = useState<SubRow[]>([]);
  const [subsTotal, setSubsTotal]         = useState(0);
  const [team, setTeam]                   = useState<TeamMember[]>([]);
  const [teamTotal, setTeamTotal]         = useState(0);
  const [teamSkip, setTeamSkip]           = useState(0);
  const [teamLoading, setTeamLoading]     = useState(false);
  const [nexaData, setNexaData]           = useState<NexaData | null>(null);
  const [loading, setLoading]             = useState(true);
  const [unlockedRewards, setUnlockedRewards] = useState(0);
  const [rewardDismissed, setRewardDismissed] = useState(false);

  const TEAM_PAGE = 20;

  type TeamResponse = { ok?: boolean; members?: TeamMember[]; total?: number; hasMore?: boolean };
  type SubsResponse = { ok?: boolean; items?: SubRow[]; total?: number };

  const load = useCallback(async () => {
    setLoading(true);
    setTeamSkip(0);
    try {
      const [t, e, s, tm, rw, nx] = await Promise.all([
        apiFetch("/api/internal/sales/tracker").then((r) => r.json() as Promise<{ ok?: boolean } & Tracker>),
        apiFetch("/api/internal/sales/earnings").then((r) => r.json() as Promise<{ ok?: boolean } & Earnings>),
        apiFetch("/api/internal/sales/subscriptions?take=20&skip=0").then((r) => r.json() as Promise<SubsResponse>),
        salesNetworkRole !== SalesNetworkRole.BDE
          ? apiFetch(`/api/internal/sales/team?take=${TEAM_PAGE}&skip=0`).then((r) => r.json() as Promise<TeamResponse>)
          : Promise.resolve({ ok: true, members: [], total: 0 } as TeamResponse),
        apiFetch("/api/internal/rewards").then((r) => r.json() as Promise<{ ok?: boolean; unlockedCount?: number }>),
        apiFetch("/api/internal/nexa/today").then((r) => r.json() as Promise<{ ok?: boolean } & NexaData>),
      ]);
      if (t.ok !== false) setTracker(t);
      if (e.ok !== false) setEarnings(e);
      if (s.ok !== false) { setSubs(s.items ?? []); setSubsTotal(s.total ?? 0); }
      if (tm.ok !== false) { setTeam(tm.members ?? []); setTeamTotal(tm.total ?? 0); }
      if (rw.ok !== false) setUnlockedRewards(rw.unlockedCount ?? 0);
      if (nx.ok !== false) setNexaData(nx);
    } catch {
      // silent — partial data is fine
    } finally {
      setLoading(false);
    }
  }, [salesNetworkRole]);

  const loadMoreTeam = useCallback(async () => {
    const nextSkip = teamSkip + TEAM_PAGE;
    setTeamLoading(true);
    try {
      const r = await apiFetch(`/api/internal/sales/team?take=${TEAM_PAGE}&skip=${nextSkip}`);
      const j = (await r.json()) as TeamResponse;
      if (j.ok !== false) {
        setTeam((prev) => [...prev, ...(j.members ?? [])]);
        setTeamSkip(nextSkip);
      }
    } catch { /* silent */ } finally {
      setTeamLoading(false);
    }
  }, [teamSkip]);

  useEffect(() => { void load(); }, [load]);

  const isBde = salesNetworkRole === SalesNetworkRole.BDE;
  const isBdm = salesNetworkRole === SalesNetworkRole.BDM;
  const isRsm = salesNetworkRole === SalesNetworkRole.RSM;
  const isBoss = salesNetworkRole === SalesNetworkRole.BOSS;

  return (
    <div
      className="min-h-full pb-20 pt-6"
      style={{ background: `linear-gradient(180deg, ${ds.colors.bgPrimary} 0%, ${ds.colors.bgSecondary} 60%)` }}
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div {...fadeUp(0)} className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {isBde ? "Sales Dashboard" : isBdm ? "BDM Dashboard" : isRsm ? "Region Overview" : "Sales Network"}
            </h1>
            <p className="mt-1 text-sm text-white/40">
              {isBde ? "Track your subscriptions and growth" : isBdm ? "Your team performance and overrides" : isRsm ? "Regional team and revenue" : "Network overview"}
            </p>
          </div>
          <button onClick={load} disabled={loading} className="rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2 text-xs font-medium text-white/50 hover:bg-white/[0.07] disabled:opacity-40 transition-colors">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </motion.div>

        {/* Reward unlocked banner */}
        <AnimatePresence>
          {unlockedRewards > 0 && !rewardDismissed && (
            <motion.div
              key="reward-banner"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/15 px-5 py-3.5 shadow-[0_8px_32px_-8px_rgba(245,158,11,0.25)]"
            >
              <span className="text-xl">🎁</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300">
                  Reward{unlockedRewards > 1 ? "s" : ""} unlocked!
                </p>
                <p className="text-xs text-amber-300/60">
                  {unlockedRewards} scratch card{unlockedRewards > 1 ? "s" : ""} ready
                </p>
              </div>
              <Link
                href="/internal/rewards"
                className="rounded-xl border border-amber-500/30 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
              >
                Scratch →
              </Link>
              <button
                onClick={() => setRewardDismissed(true)}
                className="text-amber-300/40 hover:text-amber-300/70 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats row */}
        <motion.div {...fadeUp(1)} className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Active Subs" value={String(tracker?.activeSubscriptions ?? "—")} accent="text-[#4FD1FF]" />
          <StatCard label="Total Points" value={tracker ? String(Math.round(tracker.totalPoints / 10)) : "—"} />
          <StatCard label="Total Earned" value={earnings ? fmt(earnings.totalAmount) : "—"} accent="text-emerald-400" />
          {isBde || isBdm ? (
            <StatCard label="Next Role" value={tracker?.progressHints?.nextRole ?? (promotionEligible(tracker) ? "Eligible!" : "—")} sub={tracker?.progressHints?.subsNeeded ? `${tracker.progressHints.subsNeeded} subs needed` : undefined} />
          ) : (
            <StatCard label="Team Size" value={String(team.length)} sub="active members" />
          )}
        </motion.div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Left column */}
          <div className="space-y-6">
            <motion.div {...fadeUp(2)}><NexaTodayPanel tracker={tracker} nexa={nexaData} /></motion.div>

            {(isBdm || isRsm || isBoss) && team.length > 0 && (
              <motion.div {...fadeUp(3)}>
                <TeamPanel team={team} total={teamTotal} onLoadMore={loadMoreTeam} loadingMore={teamLoading} />
              </motion.div>
            )}

            <motion.div {...fadeUp(4)}><SubscriptionsPanel subs={subs} total={subsTotal} /></motion.div>

            {/* BDM: team performance summary */}
            {isBdm && team.length > 0 && (
              <motion.div {...fadeUp(5)}>
                <div className={`${glassPanel} p-6`}>
                  <p className="mb-4 text-sm font-semibold text-white">Team Performance</p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                      <p className="text-xs text-white/40">Team Subs</p>
                      <p className="mt-1 text-xl font-bold text-white">{team.reduce((a, m) => a + m.activeSubscriptions, 0)}</p>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                      <p className="text-xs text-white/40">Team Points</p>
                      <p className="mt-1 text-xl font-bold text-[#4FD1FF]">{Math.round(team.reduce((a, m) => a + m.totalPoints, 0) / 10)}</p>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                      <p className="text-xs text-white/40">Team Earnings</p>
                      <p className="mt-1 text-xl font-bold text-emerald-400">Team</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Link href="/internal/team" className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-center text-sm font-medium text-white/60 hover:bg-white/[0.07] transition-colors">
                      Manage Team
                    </Link>
                    <Link href="/internal/onboard-company" className="flex-1 rounded-xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/10 px-4 py-2.5 text-center text-sm font-medium text-[#4FD1FF] hover:bg-[#4FD1FF]/20 transition-colors">
                      Assign Lead
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}

            {/* RSM: region control */}
            {isRsm && (
              <motion.div {...fadeUp(5)}>
                <div className={`${glassPanel} p-6`}>
                  <p className="mb-4 text-sm font-semibold text-white">Region Controls</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {["Assign Leads", "Broadcast", "Set Focus"].map((action) => (
                      <button key={action} className={`${glassPanelHover} rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 text-center text-sm font-medium text-white/60 hover:text-white transition-all`}>
                        {action}
                      </button>
                    ))}
                    <Link
                      href="/internal/training"
                      className={`${glassPanelHover} rounded-xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/8 p-4 text-center text-sm font-medium text-[#4FD1FF] hover:bg-[#4FD1FF]/15 transition-all`}
                    >
                      Training Center
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <motion.div {...fadeUp(2)}><ProgressTracker tracker={tracker} /></motion.div>
            <motion.div {...fadeUp(3)}><WalletSummary earnings={earnings} /></motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function promotionEligible(tracker: Tracker | null): boolean {
  return tracker?.promotionEligible === true;
}
