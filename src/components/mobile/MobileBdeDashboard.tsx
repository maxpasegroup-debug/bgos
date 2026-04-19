"use client";

/**
 * MobileBdeDashboard — mobile-only BDE sales dashboard
 *
 * 5 stacked cards:
 *   1. Target       — ₹30 K goal, points + progress bar
 *   2. Nexa Today   — max 3 tasks, tap to complete
 *   3. Quick Leads  — 3 recent subscriptions, View All
 *   4. Rewards      — unlock / scratch card teaser
 *   5. Wallet       — total + bonus summary
 *
 * STRICT: no tables, no desktop layout reuse.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api-fetch";
import {
  staggerContainer,
  staggerItem,
  AnimatedProgress,
  MotionCard,
} from "@/components/mobile/MotionWrapper";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tracker = {
  totalPoints:         number;
  activeSubscriptions: number;
  promotionEligible:   boolean;
  progressHints:       { progressPercent?: number; subsNeeded?: number };
  bdmRecurring:        { tier: string; monthlyAmount: number } | null;
};

type NexaMsg = {
  type:     "task_reminder" | "performance" | "urgency" | "recognition";
  text:     string;
  cta:      string;
  action:   string;
  priority: number;
};

type NexaData = {
  messages:     NexaMsg[];
  extraTasks:   string[];
  urgencyLevel: "calm" | "normal" | "high" | "critical";
};

type SubRow = {
  id:        string;
  planType:  string;
  points:    number;
  status:    string;
  isActive:  boolean;
  startedAt: string;
  ownerName: string;
};

type WalletData = {
  totalBalance:       number;
  bonusBalance:       number;
  pendingBalance:     number;
  withdrawableBalance: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MILESTONE_TARGET = 30_000;
const MILESTONE_POINTS = 20;

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n);
}

function displayPoints(rawPoints: number) {
  return Math.round(rawPoints / 10);
}

const PLAN_COLORS: Record<string, string> = {
  BASIC:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  PRO:    "bg-cyan-500/15    text-cyan-400    border-cyan-500/25",
  CUSTOM: "bg-violet-500/15  text-violet-400  border-violet-500/25",
};


// ---------------------------------------------------------------------------
// Card shell
// ---------------------------------------------------------------------------

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <MotionCard
      tapScale={0.985}
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.03] ${className}`}
    >
      {children}
    </MotionCard>
  );
}

function CardHeader({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-5 pt-5 pb-1">
      {icon && <span className="text-base">{icon}</span>}
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CARD 1 — Target
// ---------------------------------------------------------------------------

function TargetCard({ tracker }: { tracker: Tracker | null }) {
  const pts    = tracker ? displayPoints(tracker.totalPoints) : 0;
  const pct    = tracker?.progressHints.progressPercent ?? Math.min(100, Math.round((pts / MILESTONE_POINTS) * 100));
  const subsNeeded = tracker?.progressHints.subsNeeded ?? Math.max(0, MILESTONE_POINTS - pts);

  return (
    <Card>
      <CardHeader label="Monthly Target" icon="🎯" />
      <div className="px-5 pb-5 pt-3 space-y-4">

        {/* Target amount */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold tracking-tight text-white">
              {fmt(MILESTONE_TARGET)}
            </p>
            <p className="mt-0.5 text-xs text-white/35">milestone reward</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#4FD1FF]">{pts}</p>
            <p className="text-[10px] text-white/30">/ {MILESTONE_POINTS} pts</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.06]">
            <AnimatedProgress
              percent={pct}
              delay={0.3}
              className="h-full rounded-full bg-gradient-to-r from-[#4FD1FF] to-[#7C5CFF] relative"
            />
            {/* Glow tip */}
            {pct > 5 && (
              <motion.div
                className="absolute top-0 right-0 h-full w-3 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(124,92,255,0.8) 0%, transparent 70%)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.6] }}
                transition={{ delay: 0.9, duration: 0.4 }}
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-white/30">
            <span>{pct}% complete</span>
            {subsNeeded > 0 && <span>{subsNeeded} pts to milestone</span>}
          </div>
        </div>

        {/* Active subs pill */}
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/[0.05] border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/60">
            {tracker?.activeSubscriptions ?? 0} active subs
          </span>
          {tracker?.promotionEligible && (
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400">
              Promotion eligible ✓
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CARD 2 — Nexa Today  (micro-prompt chips, tap → navigate)
// ---------------------------------------------------------------------------

const CHIP_STYLE: Record<NexaMsg["type"], { border: string; dot: string }> = {
  task_reminder: { border: "border-l-[#4FD1FF]",   dot: "bg-[#4FD1FF]"   },
  performance:   { border: "border-l-amber-400",   dot: "bg-amber-400"   },
  urgency:       { border: "border-l-red-400",     dot: "bg-red-400"     },
  recognition:   { border: "border-l-emerald-400", dot: "bg-emerald-400" },
};

function NexaCard({ nexa }: { nexa: NexaData | null }) {
  const router = useRouter();
  const [done, setDone] = useState<Set<number>>(new Set());

  const tasks = nexa?.messages.slice(0, 3) ?? [];

  async function handleTap(msg: NexaMsg, idx: number) {
    setDone((prev) => new Set([...prev, idx]));
    try {
      await apiFetch("/api/internal/nexa/track", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ event: "task_complete" }),
      });
    } catch { /* silent */ }
    router.push(msg.action ?? "/internal/leads");
  }

  return (
    <Card>
      <CardHeader label="Nexa Today" icon="⚡" />
      <div className="px-5 pb-5 pt-2 space-y-2">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center py-6 gap-2 text-white/25">
            <span className="text-2xl">✅</span>
            <p className="text-[13px]">All clear for today</p>
          </div>
        ) : (
          tasks.map((msg, i) => {
            const chip   = CHIP_STYLE[msg.type] ?? CHIP_STYLE.task_reminder;
            const isDone = done.has(i);
            const isUrgent = msg.type === "urgency";
            return (
              <motion.button
                key={i}
                onClick={() => void handleTap(msg, i)}
                disabled={isDone}
                initial={{ opacity: 0, x: -12 }}
                animate={isUrgent && !isDone
                  ? { opacity: 1, x: [0, -2, 2, -1, 0] }
                  : { opacity: isDone ? 0.35 : 1, x: 0 }
                }
                transition={isUrgent
                  ? { opacity: { duration: 0.25, delay: i * 0.08 }, x: { duration: 0.4, delay: i * 0.08 + 0.4 } }
                  : { duration: 0.25, delay: i * 0.08 }
                }
                whileTap={{ scale: 0.97 }}
                className={[
                  "w-full flex items-center gap-3 rounded-xl border-l-4 px-4 py-3 text-left",
                  "bg-white/[0.03]",
                  chip.border,
                  isDone ? "opacity-35" : "",
                ].join(" ")}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${chip.dot}`} />
                <p
                  className={[
                    "flex-1 text-[14px] font-medium leading-none truncate",
                    isDone ? "line-through text-white/30" : "text-white/85",
                  ].join(" ")}
                >
                  {msg.text}
                </p>
                {!isDone && (
                  <span className="text-white/25 text-[13px] shrink-0">›</span>
                )}
              </motion.button>
            );
          })
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CARD 3 — Quick Leads
// ---------------------------------------------------------------------------

function QuickLeadsCard({ subs }: { subs: SubRow[] }) {
  return (
    <Card>
      <CardHeader label="Quick Leads" icon="📋" />
      <div className="px-5 pb-5 pt-2 space-y-2">
        {subs.length === 0 ? (
          <div className="flex flex-col items-center py-6 gap-2 text-white/25">
            <span className="text-3xl">📭</span>
            <p className="text-sm">No subscriptions yet</p>
          </div>
        ) : (
          subs.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-xl bg-white/[0.025] border border-white/[0.06] px-4 py-3"
            >
              {/* Status dot */}
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${s.isActive ? "bg-emerald-400" : "bg-white/20"}`}
              />

              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-white/80">{s.ownerName}</p>
                <p className="text-[11px] text-white/35">
                  {new Date(s.startedAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short",
                  })}
                </p>
              </div>

              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PLAN_COLORS[s.planType] ?? "bg-white/10 text-white/40 border-white/10"}`}
              >
                {s.planType}
              </span>
            </div>
          ))
        )}

        <Link
          href="/internal/leads"
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/8 py-3 text-sm font-semibold text-[#4FD1FF] active:opacity-70 transition-opacity"
        >
          View All Leads
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CARD 4 — Rewards
// ---------------------------------------------------------------------------

function RewardsCard({ unlockedCount }: { unlockedCount: number }) {
  const hasReward = unlockedCount > 0;

  return (
    <Card className={hasReward ? "border-amber-500/25" : ""}>
      <CardHeader label="Rewards" icon="🎁" />
      <div className="px-5 pb-5 pt-2">
        {hasReward ? (
          <div className="flex flex-col items-center gap-4 py-3">
            {/* Animated gift orb */}
            <div className="relative">
              {/* Pulsing glow ring */}
              <motion.div
                className="absolute inset-0 rounded-full bg-amber-500/25 blur-xl"
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              />
              {/* Shimmer overlay on icon */}
              <motion.div
                className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-500/40 bg-amber-500/10 text-4xl overflow-hidden"
              >
                🎁
                {/* Shimmer sweep */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,200,50,0.35) 50%, transparent 60%)" }}
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "linear", repeatDelay: 0.5 }}
                />
              </motion.div>
            </div>

            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
            >
              <p className="text-base font-bold text-white">
                {unlockedCount === 1 ? "Reward Unlocked!" : `${unlockedCount} Rewards Unlocked!`}
              </p>
              <p className="mt-1 text-xs text-white/40">Tap to reveal your scratch card</p>
            </motion.div>

            <motion.div
              className="w-full"
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.1 }}
            >
              <Link
                href="/internal/rewards"
                className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-sm font-bold text-black shadow-[0_4px_24px_-4px_rgba(245,158,11,0.6)] overflow-hidden relative"
              >
                {/* Shine sweep */}
                <motion.div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.3) 50%, transparent 65%)" }}
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "linear", repeatDelay: 1 }}
                />
                <span className="relative">Scratch Now →</span>
              </Link>
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <motion.span
              className="text-3xl opacity-40"
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", repeatDelay: 1 }}
            >
              🏆
            </motion.span>
            <p className="text-sm text-white/40">Keep going for your next reward</p>
            <Link
              href="/internal/rewards"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/50 active:opacity-60"
            >
              View Rewards
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CARD 5 — Wallet Summary
// ---------------------------------------------------------------------------

function WalletCard({ wallet }: { wallet: WalletData | null }) {
  return (
    <Card>
      <CardHeader label="Wallet" icon="💰" />
      <div className="px-5 pb-5 pt-3 space-y-4">

        {/* Total earned */}
        <div>
          <p className="text-[11px] text-white/35">Total Balance</p>
          <p className="mt-0.5 text-3xl font-bold tracking-tight text-white">
            {fmt(wallet?.totalBalance ?? 0)}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Withdrawable", value: fmt(wallet?.withdrawableBalance ?? 0), color: "text-emerald-400" },
            { label: "Bonus",        value: fmt(wallet?.bonusBalance       ?? 0), color: "text-amber-400" },
            { label: "Pending",      value: fmt(wallet?.pendingBalance      ?? 0), color: "text-white/50" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-3"
            >
              <p className="text-[9px] uppercase tracking-wider text-white/30">{s.label}</p>
              <p className={`mt-1 text-sm font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <Link
          href="/internal/wallet"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 text-sm font-medium text-white/60 active:opacity-60 transition-opacity"
        >
          View Wallet
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function MobileBdeDashboard() {
  const [tracker,        setTracker]        = useState<Tracker | null>(null);
  const [nexa,           setNexa]           = useState<NexaData | null>(null);
  const [subs,           setSubs]           = useState<SubRow[]>([]);
  const [wallet,         setWallet]         = useState<WalletData | null>(null);
  const [unlockedRewards,setUnlockedRewards] = useState(0);
  const [loading,        setLoading]        = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, nx, s, w, rw] = await Promise.all([
        apiFetch("/api/internal/sales/tracker")
          .then((r) => r.json() as Promise<{ ok?: boolean } & Tracker>),
        apiFetch("/api/internal/nexa/today")
          .then((r) => r.json() as Promise<{ ok?: boolean } & NexaData>),
        apiFetch("/api/internal/sales/subscriptions?take=3&skip=0")
          .then((r) => r.json() as Promise<{ ok?: boolean; items?: SubRow[] }>),
        apiFetch("/api/internal/wallet")
          .then((r) => r.json() as Promise<{ ok?: boolean } & WalletData>),
        apiFetch("/api/internal/rewards")
          .then((r) => r.json() as Promise<{ ok?: boolean; unlockedCount?: number }>),
      ]);
      if (t.ok  !== false) setTracker(t);
      if (nx.ok !== false) setNexa(nx);
      if (s.ok  !== false) setSubs(s.items ?? []);
      if (w.ok  !== false) setWallet(w);
      if (rw.ok !== false) setUnlockedRewards(rw.unlockedCount ?? 0);
    } catch { /* silent */ }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="px-4 py-5 space-y-4">

      {/* Pull-to-refresh hint */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">My Dashboard</h2>
          <p className="text-xs text-white/30">BDE — Sales</p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] text-white/40 disabled:opacity-30 active:scale-90 transition-transform"
          aria-label="Refresh"
        >
          <svg
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            fill="none" viewBox="0 0 24 24"
          >
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {loading ? (
        /* Skeleton shimmer */
        <div className="space-y-4">
          {[80, 120, 100, 60, 90].map((h, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse"
              style={{ height: h }}
            />
          ))}
        </div>
      ) : (
        <motion.div
          className="space-y-4"
          initial="hidden"
          animate="show"
          variants={staggerContainer}
        >
          {[
            <TargetCard    key="target"  tracker={tracker} />,
            <NexaCard      key="nexa"    nexa={nexa} />,
            <QuickLeadsCard key="leads"  subs={subs} />,
            <RewardsCard   key="rewards" unlockedCount={unlockedRewards} />,
            <WalletCard    key="wallet"  wallet={wallet} />,
          ].map((card, i) => (
            <motion.div key={i} variants={staggerItem}>
              {card}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
