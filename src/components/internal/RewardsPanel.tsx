"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api-fetch";
import { glassPanel, ds } from "@/styles/design-system";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Claim = {
  id: string;
  rewardId: string;
  title: string;
  type: string;
  value: number | null; // null = UNLOCKED (hidden)
  status: "UNLOCKED" | "REVEALED" | "CREDITED";
  created_at: string;
};

type Competition = {
  id: string;
  title: string;
  description: string | null;
  targetType: string;
  targetValue: number;
  rewardType: string;
  rewardValue: number;
  rewardNote: string | null;
  endDate: string;
  myProgress: number;
  myRank: number | null;
  leaderboard: { userId: string; name: string; progress: number; rank: number | null }[];
};

type RewardsData = {
  unlockedCount: number;
  claims: Claim[];
  competitions: Competition[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function daysLeft(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

// ---------------------------------------------------------------------------
// Scratch Card component
// ---------------------------------------------------------------------------

function ScratchCard({
  claim,
  onRevealed,
}: {
  claim: Claim;
  onRevealed: (claimId: string, value: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(
    claim.status !== "UNLOCKED",
  );
  const [value, setValue] = useState<number | null>(claim.value);
  const [scratching, setScratching] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const scratchedPct = useRef(0);
  const isDrawing = useRef(false);

  // Paint the scratch overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || revealed) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#1e293b");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Shimmer lines
    ctx.strokeStyle = "rgba(79,209,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 18) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    // Label
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✦  SCRATCH TO REVEAL  ✦", canvas.width / 2, canvas.height / 2);
  }, [revealed]);

  function scratch(x: number, y: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // Estimate scratched % by sampling
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent++;
    }
    scratchedPct.current = (transparent / (canvas.width * canvas.height)) * 100;

    // Auto-reveal at 45%
    if (scratchedPct.current > 45 && !revealing) {
      void triggerReveal();
    }
  }

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  async function triggerReveal() {
    if (revealing || revealed) return;
    setRevealing(true);
    try {
      const res = await apiFetch("/api/internal/rewards/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: claim.id }),
      });
      const j = (await res.json()) as { ok?: boolean; value?: number };
      if (j.ok && j.value != null) {
        setValue(j.value);
        setRevealed(true);
        onRevealed(claim.id, j.value);
      }
    } catch {
      // silent
    } finally {
      setRevealing(false);
    }
  }

  const typeColors: Record<string, string> = {
    SCRATCH: "from-amber-500/30 to-orange-500/20 border-amber-500/30",
    MILESTONE: "from-violet-500/30 to-purple-500/20 border-violet-500/30",
    COMPETITION: "from-cyan-500/30 to-blue-500/20 border-cyan-500/30",
  };

  const colorClass = typeColors[claim.type] ?? typeColors.SCRATCH;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative overflow-hidden rounded-[20px] border bg-gradient-to-br ${colorClass} p-4`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
            {claim.type === "SCRATCH" ? "Scratch Card" : claim.type === "MILESTONE" ? "Milestone" : "Competition"}
          </p>
          <p className="text-sm font-semibold text-white leading-tight">{claim.title}</p>
        </div>
        <span className="text-xl">{claim.type === "SCRATCH" ? "🎁" : claim.type === "MILESTONE" ? "🏆" : "⭐"}</span>
      </div>

      {/* Scratch area */}
      <div className="relative rounded-xl overflow-hidden" style={{ height: 80 }}>
        {/* Reward value underneath */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-xl">
          {revealed && value != null ? (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-center"
            >
              <p className="text-2xl font-bold text-amber-400">{fmt(value)}</p>
              <p className="text-[10px] text-white/40 mt-0.5">Credited to Wallet</p>
            </motion.div>
          ) : (
            <p className="text-3xl">💰</p>
          )}
        </div>

        {/* Scratch overlay canvas */}
        {!revealed && (
          <canvas
            ref={canvasRef}
            width={280}
            height={80}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none select-none rounded-xl"
            onMouseDown={() => { isDrawing.current = true; setScratching(true); }}
            onMouseUp={() => { isDrawing.current = false; }}
            onMouseLeave={() => { isDrawing.current = false; setScratching(false); }}
            onMouseMove={(e) => { if (isDrawing.current) { const p = getPos(e); if (p) scratch(p.x, p.y); } }}
            onTouchStart={(e) => { isDrawing.current = true; const p = getPos(e); if (p) scratch(p.x, p.y); }}
            onTouchEnd={() => { isDrawing.current = false; }}
            onTouchMove={(e) => { e.preventDefault(); if (isDrawing.current) { const p = getPos(e); if (p) scratch(p.x, p.y); } }}
          />
        )}

        {revealing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
            <p className="text-xs text-white/60 animate-pulse">Revealing…</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {!revealed && !revealing && (
        <p className="mt-2 text-center text-[10px] text-white/30">
          {scratching ? "Keep scratching…" : "Drag to scratch"}
        </p>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Competition card
// ---------------------------------------------------------------------------

function CompetitionCard({ comp }: { comp: Competition }) {
  const pct = Math.min(100, (comp.myProgress / comp.targetValue) * 100);
  const days = daysLeft(comp.endDate);

  const rewardBadge: Record<string, string> = {
    CASH: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    GIFT: "bg-violet-500/15 text-violet-400 border-violet-500/25",
    POINTS_BONUS: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  };

  return (
    <div className={`${glassPanel} p-5 space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white leading-tight truncate">{comp.title}</p>
          {comp.description && (
            <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{comp.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${rewardBadge[comp.rewardType] ?? rewardBadge.GIFT}`}>
            {comp.rewardType === "CASH" ? fmt(comp.rewardValue) : comp.rewardNote ?? comp.rewardType}
          </span>
          <span className={`text-[10px] font-medium ${days <= 3 ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-white/30"}`}>
            {days === 0 ? "Ends today" : `${days}d left`}
          </span>
        </div>
      </div>

      {/* My progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-white/40">
            {comp.targetType} target: {comp.targetValue}
          </span>
          <span className="font-semibold text-white">
            {comp.myProgress} / {comp.targetValue}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#4FD1FF] to-[#7C5CFF]"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>
        {comp.myRank && (
          <p className="text-xs text-white/40">Your rank: #{comp.myRank}</p>
        )}
      </div>

      {/* Mini leaderboard */}
      {comp.leaderboard.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Leaderboard</p>
          <ul className="space-y-1">
            {comp.leaderboard.slice(0, 3).map((p, i) => (
              <li key={p.userId} className="flex items-center gap-2 text-xs">
                <span className={`w-4 text-center font-bold ${i === 0 ? "text-amber-400" : "text-white/30"}`}>
                  #{i + 1}
                </span>
                <span className="flex-1 truncate text-white/60">{p.name}</span>
                <span className="font-semibold text-white/70">{p.progress}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification banner (floating, dismissible)
// ---------------------------------------------------------------------------

export function RewardUnlockedBanner({
  count,
  onDismiss,
}: {
  count: number;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/15 px-5 py-3.5 shadow-[0_8px_32px_-8px_rgba(245,158,11,0.3)]"
        >
          <span className="text-xl">🎁</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">
              Reward{count > 1 ? "s" : ""} unlocked!
            </p>
            <p className="text-xs text-amber-300/60">
              You have {count} scratch card{count > 1 ? "s" : ""} waiting
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="ml-2 text-amber-300/50 hover:text-amber-300 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Main RewardsPanel
// ---------------------------------------------------------------------------

export function RewardsPanel() {
  const [data, setData] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"cards" | "competitions">("cards");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/internal/rewards");
      const j = (await res.json()) as RewardsData & { ok?: boolean };
      if (j.ok !== false) setData(j);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function handleRevealed(claimId: string, value: number) {
    setData((d) => {
      if (!d) return d;
      return {
        ...d,
        unlockedCount: Math.max(0, d.unlockedCount - 1),
        claims: d.claims.map((c) =>
          c.id === claimId ? { ...c, value, status: "CREDITED" as const } : c,
        ),
      };
    });
  }

  const unlockedCards = data?.claims.filter((c) => c.status === "UNLOCKED") ?? [];
  const revealedCards = data?.claims.filter((c) => c.status !== "UNLOCKED") ?? [];
  const competitions = data?.competitions ?? [];

  return (
    <div
      className="min-h-full pb-20 pt-6"
      style={{ background: `linear-gradient(180deg, ${ds.colors.bgPrimary} 0%, ${ds.colors.bgSecondary} 60%)` }}
    >
      <div className="mx-auto w-full max-w-[900px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Gamification</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Rewards</h1>
            <p className="mt-1 text-sm text-white/40">Scratch cards, milestones, and competitions</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2 text-xs font-medium text-white/50 hover:bg-white/[0.07] disabled:opacity-40 transition-colors"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </motion.div>

        {/* Unlocked banner */}
        {(data?.unlockedCount ?? 0) > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <RewardUnlockedBanner
              count={data!.unlockedCount}
              onDismiss={() => setData((d) => d ? { ...d, unlockedCount: 0 } : d)}
            />
          </motion.div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {(["cards", "competitions"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "rounded-xl px-4 py-2 text-sm font-medium transition-all",
                tab === t
                  ? "bg-white/[0.09] text-white border border-white/[0.15]"
                  : "text-white/40 hover:text-white/60",
              ].join(" ")}
            >
              {t === "cards" ? `Scratch Cards ${unlockedCards.length > 0 ? `(${unlockedCards.length})` : ""}` : `Competitions ${competitions.length > 0 ? `(${competitions.length})` : ""}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${glassPanel} p-5 animate-pulse h-44`} />
            ))}
          </div>
        ) : tab === "cards" ? (
          <div className="space-y-6">
            {/* Unlocked cards — scratch these */}
            {unlockedCards.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-400">
                  Ready to Scratch
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <AnimatePresence>
                    {unlockedCards.map((c) => (
                      <ScratchCard key={c.id} claim={c} onRevealed={handleRevealed} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Revealed/credited history */}
            {revealedCards.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">
                  History
                </p>
                <div className={`${glassPanel} overflow-hidden`}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.05]">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30">Reward</th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30">Value</th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revealedCards.map((c) => (
                        <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span>{c.type === "SCRATCH" ? "🎁" : c.type === "MILESTONE" ? "🏆" : "⭐"}</span>
                              <span className="text-white/70">{c.title}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-amber-400">
                            {c.value != null ? fmt(c.value) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-white/30 tabular-nums">
                            {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {unlockedCards.length === 0 && revealedCards.length === 0 && (
              <div className={`${glassPanel} flex flex-col items-center gap-3 py-16 text-center`}>
                <span className="text-4xl">🎁</span>
                <p className="text-white/40">No rewards yet</p>
                <p className="text-sm text-white/30 max-w-xs">
                  Earn points and close sales — scratch cards unlock automatically at milestones.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {competitions.length === 0 ? (
              <div className={`${glassPanel} flex flex-col items-center gap-3 py-16 text-center`}>
                <span className="text-4xl">🏆</span>
                <p className="text-white/40">No active competitions</p>
                <p className="text-sm text-white/30 max-w-xs">
                  Check back soon — competitions are created by the Boss.
                </p>
              </div>
            ) : (
              competitions.map((c) => <CompetitionCard key={c.id} comp={c} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
