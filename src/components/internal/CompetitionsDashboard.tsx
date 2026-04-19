"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SalesNetworkRole } from "@prisma/client";
import { apiFetch } from "@/lib/api-fetch";
import { useInternalSession } from "./InternalSessionContext";
import { glassPanel, glassPanelHover, ds } from "@/styles/design-system";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LeaderboardEntry = {
  userId: string;
  userName: string | null;
  role: SalesNetworkRole | null;
  score: number;
  rank: number;
};

type CompetitionEntry = {
  id: string;
  title: string;
  description: string | null;
  targetType: string;
  targetValue: number;
  rewardType: string;
  rewardValue: number;
  rewardNote: string | null;
  startDate: string;
  endDate: string;
  active: boolean;
  myProgress: number;
  myRank: number | null;
  leaderboard: { userId: string; name: string; progress: number; rank: number | null }[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fadeUp(i = 0) {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay: i * 0.05 },
  };
}

const ROLE_BADGE: Record<SalesNetworkRole, { label: string; color: string }> = {
  BOSS:      { label: "BOSS",  color: "text-violet-400" },
  RSM:       { label: "RSM",   color: "text-amber-400"  },
  BDM:       { label: "BDM",   color: "text-[#4FD1FF]"  },
  BDE:       { label: "BDE",   color: "text-emerald-400"},
  TECH_EXEC: { label: "TECH",  color: "text-white/40"   },
};

const RANK_COLORS = ["text-amber-400", "text-slate-300", "text-orange-400"];
const RANK_ICONS  = ["🥇", "🥈", "🥉"];

function rankMedal(rank: number): string {
  return rank <= 3 ? RANK_ICONS[rank - 1]! : `#${rank}`;
}

function rankColor(rank: number, isMe: boolean): string {
  if (isMe) return "text-[#4FD1FF]";
  return RANK_COLORS[rank - 1] ?? "text-white/50";
}

function daysLeft(endDate: string): number {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000));
}

function pct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function Bar({ value, max, color = "from-[#4FD1FF] to-[#7C5CFF]" }: { value: number; max: number; color?: string }) {
  const p = pct(value, max);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rank badge
// ---------------------------------------------------------------------------

function RankBadge({ rank, isMe }: { rank: number; isMe: boolean }) {
  return (
    <span className={`min-w-[2rem] text-center font-bold tabular-nums text-base ${rankColor(rank, isMe)}`}>
      {rank <= 3 ? RANK_ICONS[rank - 1] : `#${rank}`}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Global Leaderboard panel
// ---------------------------------------------------------------------------

function LeaderboardPanel({
  entries,
  myUserId,
  myRank,
  myScore,
}: {
  entries: LeaderboardEntry[];
  myUserId: string;
  myRank: number | null;
  myScore: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const top3 = entries.slice(0, 3);
  const rest  = entries.slice(3);
  const visible = expanded ? entries : entries.slice(0, 10);
  const topScore = entries[0]?.score ?? 1;

  return (
    <div className={`${glassPanel} p-6`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Global Leaderboard</p>
          <h2 className="mt-1 text-lg font-bold text-white">Top Performers</h2>
          <p className="mt-0.5 text-xs text-white/30">Ranked by total points · updated daily</p>
        </div>
        {myRank && (
          <div className="shrink-0 rounded-2xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/8 px-4 py-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4FD1FF]/70">Your Rank</p>
            <p className="mt-0.5 text-xl font-bold text-[#4FD1FF]">{rankMedal(myRank)}</p>
            {myScore !== null && <p className="text-[10px] text-white/30">{myScore} pts</p>}
          </div>
        )}
      </div>

      {/* Podium — top 3 */}
      {top3.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[top3[1], top3[0], top3[2]].map((entry, podiumIdx) => {
            if (!entry) return <div key={podiumIdx} />;
            const podiumRank = podiumIdx === 1 ? 1 : podiumIdx === 0 ? 2 : 3;
            const isMe = entry.userId === myUserId;
            const rb = entry.role ? ROLE_BADGE[entry.role] : null;
            const heights = ["h-20", "h-28", "h-16"];
            return (
              <motion.div
                key={entry.userId}
                {...fadeUp(podiumIdx)}
                className={`flex flex-col items-center justify-end gap-2 rounded-2xl border pb-4 pt-3 ${
                  podiumIdx === 1
                    ? "border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent"
                    : "border-white/[0.06] bg-white/[0.02]"
                } ${isMe ? "ring-1 ring-[#4FD1FF]/30" : ""}`}
              >
                <div className={`w-full flex items-end justify-center ${heights[podiumIdx]}`}>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-2xl">{RANK_ICONS[podiumRank - 1]}</span>
                    <p className="max-w-[80px] truncate text-center text-xs font-semibold text-white">
                      {entry.userName ?? "—"}
                    </p>
                    {rb && <span className={`text-[9px] font-bold uppercase ${rb.color}`}>{rb.label}</span>}
                  </div>
                </div>
                <p className="text-sm font-bold text-white">{entry.score}<span className="text-xs text-white/30"> pts</span></p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Ranked list */}
      {entries.length === 0 ? (
        <div className="py-10 text-center text-sm text-white/30">No rankings yet — check back after the daily update.</div>
      ) : (
        <div className="space-y-1">
          {visible.map((entry, i) => {
            const isMe = entry.userId === myUserId;
            const rb = entry.role ? ROLE_BADGE[entry.role] : null;
            const barPct = pct(entry.score, topScore);

            return (
              <motion.div
                key={entry.userId}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  isMe
                    ? "border border-[#4FD1FF]/20 bg-[#4FD1FF]/8"
                    : "border border-transparent hover:bg-white/[0.03]"
                }`}
              >
                <RankBadge rank={entry.rank} isMe={isMe} />

                {/* Name + role */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`truncate text-sm font-medium ${isMe ? "text-[#4FD1FF]" : "text-white/80"}`}>
                      {entry.userName ?? "—"}
                      {isMe && <span className="ml-1 text-[10px] text-[#4FD1FF]/60">(you)</span>}
                    </p>
                    {rb && (
                      <span className={`shrink-0 text-[9px] font-bold uppercase ${rb.color}`}>{rb.label}</span>
                    )}
                  </div>
                  {/* Progress bar relative to #1 */}
                  <div className="mt-1.5">
                    <Bar value={entry.score} max={topScore} />
                  </div>
                </div>

                <p className="shrink-0 tabular-nums text-sm font-semibold text-white/70">
                  {entry.score}<span className="text-xs text-white/30"> pts</span>
                </p>
              </motion.div>
            );
          })}
        </div>
      )}

      {rest.length > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 w-full rounded-xl border border-white/[0.07] py-2.5 text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
        >
          {expanded ? "Show less" : `Show ${rest.length} more`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Competition card
// ---------------------------------------------------------------------------

function CompetitionCard({ comp, myUserId }: { comp: CompetitionEntry; myUserId: string }) {
  const days = daysLeft(comp.endDate);
  const progPct = pct(comp.myProgress, comp.targetValue);
  const topScore = comp.leaderboard[0]?.progress ?? 1;

  return (
    <div className={`${glassPanel} ${glassPanelHover} flex flex-col gap-5 p-5`}>
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white">{comp.title}</p>
          {comp.description && (
            <p className="mt-0.5 text-xs text-white/40 line-clamp-2">{comp.description}</p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            days <= 3
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : days <= 7
              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
              : "border-white/10 bg-white/[0.04] text-white/40"
          }`}>
            {days === 0 ? "Ends today" : `${days}d left`}
          </span>
          <span className="text-[10px] text-white/30">{comp.targetType}</span>
        </div>
      </div>

      {/* My progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50">My progress</span>
          <span className="font-semibold text-white">
            {comp.myProgress} <span className="text-white/30">/ {comp.targetValue}</span>
          </span>
        </div>
        <Bar
          value={comp.myProgress}
          max={comp.targetValue}
          color={progPct >= 100 ? "from-emerald-400 to-emerald-500" : progPct >= 60 ? "from-[#4FD1FF] to-[#7C5CFF]" : "from-amber-500 to-orange-500"}
        />
        {comp.myRank && (
          <p className="text-[10px] text-white/30">Your rank: <span className="font-semibold text-[#4FD1FF]">{rankMedal(comp.myRank)}</span></p>
        )}
      </div>

      {/* Reward */}
      <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2">
        <span className="text-base">🏆</span>
        <div>
          <p className="text-xs font-semibold text-amber-300">
            {comp.rewardType === "CASH" ? `₹${comp.rewardValue.toLocaleString("en-IN")} Cash` : comp.rewardNote ?? comp.rewardType}
          </p>
          {comp.rewardNote && comp.rewardType === "CASH" && (
            <p className="text-[10px] text-amber-300/50">{comp.rewardNote}</p>
          )}
        </div>
      </div>

      {/* Mini leaderboard */}
      {comp.leaderboard.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Top Competitors</p>
          <div className="space-y-1.5">
            {comp.leaderboard.slice(0, 5).map((p) => {
              const isMe = p.userId === myUserId;
              return (
                <div key={p.userId} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 ${isMe ? "bg-[#4FD1FF]/8" : ""}`}>
                  <span className={`w-5 shrink-0 text-xs font-bold text-center ${rankColor(p.rank ?? 99, isMe)}`}>
                    {p.rank && p.rank <= 3 ? RANK_ICONS[p.rank - 1] : `${p.rank ?? "—"}`}
                  </span>
                  <p className={`flex-1 truncate text-xs ${isMe ? "font-semibold text-[#4FD1FF]" : "text-white/60"}`}>
                    {p.name}{isMe ? " (you)" : ""}
                  </p>
                  <div className="w-20 shrink-0">
                    <Bar value={p.progress} max={topScore} />
                  </div>
                  <span className="shrink-0 tabular-nums text-xs text-white/40">{p.progress}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyCompetitions() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl">🏁</span>
      <p className="mt-4 text-base font-semibold text-white/60">No active competitions</p>
      <p className="mt-1.5 text-sm text-white/30">Check back later or ask your BOSS to create one.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export function CompetitionsDashboard() {
  const { userId, salesNetworkRole } = useInternalSession();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [competitions, setCompetitions] = useState<CompetitionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lb, comps] = await Promise.all([
        apiFetch("/api/internal/leaderboard").then((r) => r.json() as Promise<{
          ok: boolean;
          entries?: LeaderboardEntry[];
          myRank?: number | null;
          myScore?: number | null;
        }>),
        apiFetch("/api/internal/rewards/competitions").then((r) => r.json() as Promise<{
          ok: boolean;
          competitions?: CompetitionEntry[];
        }>),
      ]);
      if (lb.ok) {
        setLeaderboard(lb.entries ?? []);
        setMyRank(lb.myRank ?? null);
        setMyScore(lb.myScore ?? null);
      }
      if (comps.ok) setCompetitions(comps.competitions ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const isBoss = salesNetworkRole === SalesNetworkRole.BOSS;

  return (
    <div
      className="min-h-full pb-20 pt-6"
      style={{ background: `linear-gradient(180deg, ${ds.colors.bgPrimary} 0%, ${ds.colors.bgSecondary} 60%)` }}
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 space-y-8">

        {/* Header */}
        <motion.div {...fadeUp(0)} className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Competitions</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Leaderboard & Challenges</h1>
            <p className="mt-1 text-sm text-white/40">Rankings updated daily · compete to win rewards</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/50 hover:bg-white/[0.07] disabled:opacity-40 transition-colors"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </motion.div>

        {loading ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className={`${glassPanel} h-96 animate-pulse`} />
            <div className={`${glassPanel} h-64 animate-pulse`} />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* Left: global leaderboard */}
            <motion.div {...fadeUp(1)}>
              <LeaderboardPanel
                entries={leaderboard}
                myUserId={userId ?? ""}
                myRank={myRank}
                myScore={myScore}
              />
            </motion.div>

            {/* Right: active competitions */}
            <div className="space-y-6">
              {/* Stats summary */}
              <motion.div {...fadeUp(1)} className="grid grid-cols-2 gap-4">
                <div className={`${glassPanel} p-4`}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Your Rank</p>
                  <p className="mt-1.5 text-2xl font-bold text-amber-400">
                    {myRank ? rankMedal(myRank) : "—"}
                  </p>
                </div>
                <div className={`${glassPanel} p-4`}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Your Points</p>
                  <p className="mt-1.5 text-2xl font-bold text-[#4FD1FF]">
                    {myScore ?? "—"}
                  </p>
                </div>
              </motion.div>

              {/* Competitions */}
              <motion.div {...fadeUp(2)}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Active Competitions</p>
                  <span className="text-xs text-white/30">{competitions.length} active</span>
                </div>
                <AnimatePresence mode="popLayout">
                  {competitions.length === 0 ? (
                    <EmptyCompetitions />
                  ) : (
                    <div className="space-y-4">
                      {competitions.map((comp, i) => (
                        <motion.div
                          key={comp.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.06 }}
                        >
                          <CompetitionCard comp={comp} myUserId={userId ?? ""} />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Boss: create competition hint */}
              {isBoss && (
                <motion.div {...fadeUp(3)}>
                  <div className={`${glassPanel} p-5 text-center`}>
                    <p className="text-sm font-semibold text-white/70">Create a Competition</p>
                    <p className="mt-1 text-xs text-white/30">Use the Boss Dashboard → Announcements panel to launch a new challenge.</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
