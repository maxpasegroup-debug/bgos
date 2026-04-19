"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TxRow = {
  id: string;
  type: string;
  amount: number;
  status: string;
  note?: string;
  created_at: string;
};

type WalletData = {
  total_balance: number;
  withdrawable_balance: number;
  bonus_balance: number;
  pending_balance: number;
  updated_at: string;
  recent_transactions: TxRow[];
};

type RewardClaim = {
  id: string;
  status: string;
  value: number | null;
  reward?: { title?: string; type?: string };
  created_at?: string;
};

type RewardsData = {
  unlockedCount: number;
  claims: RewardClaim[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

// ---------------------------------------------------------------------------
// Activity type meta (no commission breakdown — just display labels)
// ---------------------------------------------------------------------------

const TYPE_META: Record<string, { label: string; dot: string; amountColor: string }> = {
  DIRECT:     { label: "Earned",    dot: "bg-emerald-400", amountColor: "text-emerald-400" },
  RECURRING:  { label: "Recurring", dot: "bg-cyan-400",    amountColor: "text-cyan-400"    },
  BONUS:      { label: "Bonus",     dot: "bg-amber-400",   amountColor: "text-amber-400"   },
  REWARD:     { label: "Reward",    dot: "bg-violet-400",  amountColor: "text-violet-400"  },
  ADJUSTMENT: { label: "Adjust",    dot: "bg-white/30",    amountColor: "text-white/50"    },
  WITHDRAWAL: { label: "Withdrawn", dot: "bg-red-400",     amountColor: "text-red-400"     },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING:  { label: "Pending",  color: "text-amber-400/80" },
  APPROVED: { label: "Approved", color: "text-cyan-400"     },
  CREDITED: { label: "Credited", color: "text-emerald-400"  },
  REJECTED: { label: "Rejected", color: "text-red-400"      },
};

// ---------------------------------------------------------------------------
// Milestone data (purely cosmetic — no internal calc shown)
// ---------------------------------------------------------------------------

function milestones(total: number, withdrawable: number) {
  return [
    { icon: "⚡", label: "First Earning",    unlocked: total > 0        },
    { icon: "💫", label: "₹10K Total",       unlocked: total >= 10000   },
    { icon: "🌟", label: "₹50K Total",       unlocked: total >= 50000   },
    { icon: "🔥", label: "₹1L Total",        unlocked: total >= 100000  },
    { icon: "🏦", label: "First Withdrawal", unlocked: withdrawable > 0 },
    { icon: "♻️", label: "Recurring Active", unlocked: false             },
  ];
}

// ---------------------------------------------------------------------------
// Hero balance card
// ---------------------------------------------------------------------------

function BalanceHero({
  total,
  withdrawable,
  bonus,
  loading,
}: {
  total: number;
  withdrawable: number;
  bonus: number;
  loading: boolean;
}) {
  return (
    <div
      className="mx-4 mt-4 rounded-2xl p-5 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(14,17,23,0.98) 0%, rgba(10,13,18,0.98) 100%)",
        border: "1px solid rgba(79,209,255,0.12)",
        boxShadow: "0 0 48px -16px rgba(79,209,255,0.12)",
      }}
    >
      {/* Subtle glow orb */}
      <div
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #4FD1FF 0%, transparent 70%)" }}
      />

      {/* Label */}
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-1">
        Total Earned
      </p>

      {/* Big number */}
      {loading ? (
        <div className="h-10 w-40 rounded-xl bg-white/[0.06] animate-pulse mb-4" />
      ) : (
        <p className="text-[34px] font-bold tracking-tight text-white leading-none mb-4">
          {fmt(total)}
        </p>
      )}

      {/* Two stat pills */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
          <p className="text-[10px] text-emerald-400/60 uppercase tracking-wide mb-0.5">
            Withdrawable
          </p>
          {loading ? (
            <div className="h-5 w-16 rounded bg-white/[0.06] animate-pulse" />
          ) : (
            <p className="text-[15px] font-bold text-emerald-400 leading-none">
              {fmt(withdrawable)}
            </p>
          )}
        </div>

        <div className="flex-1 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
          <p className="text-[10px] text-amber-400/60 uppercase tracking-wide mb-0.5">
            Bonus
          </p>
          {loading ? (
            <div className="h-5 w-16 rounded bg-white/[0.06] animate-pulse" />
          ) : (
            <p className="text-[15px] font-bold text-amber-400 leading-none">
              {fmt(bonus)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity list row
// ---------------------------------------------------------------------------

function ActivityRow({ tx }: { tx: TxRow }) {
  const tm  = TYPE_META[tx.type]    ?? TYPE_META.ADJUSTMENT;
  const sm  = STATUS_META[tx.status] ?? { label: tx.status, color: "text-white/40" };
  const neg = tx.amount < 0;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/[0.05] last:border-none">
      {/* Dot */}
      <div className={`w-2 h-2 rounded-full shrink-0 ${tm.dot}`} />

      {/* Label + note */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-white/80 leading-snug">{tm.label}</p>
        {tx.note && (
          <p className="text-[11px] text-white/35 truncate">{tx.note}</p>
        )}
      </div>

      {/* Amount + date + status */}
      <div className="text-right shrink-0">
        <p className={`text-[14px] font-semibold tabular-nums leading-snug ${neg ? "text-red-400" : tm.amountColor}`}>
          {neg ? "−" : "+"}{fmt(tx.amount)}
        </p>
        <div className="flex items-center justify-end gap-1.5 mt-0.5">
          <span className={`text-[10px] ${sm.color}`}>{sm.label}</span>
          <span className="text-[10px] text-white/20">·</span>
          <span className="text-[10px] text-white/30">{shortDate(tx.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MobileWalletPage
// ---------------------------------------------------------------------------

export function MobileWalletPage() {
  const [wallet, setWallet]   = useState<WalletData | null>(null);
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wRes, rRes] = await Promise.all([
        apiFetch("/api/internal/wallet"),
        apiFetch("/api/internal/rewards"),
      ]);

      const w = (await wRes.json()) as WalletData & { ok?: boolean };
      if (w.ok !== false) setWallet(w);

      const r = (await rRes.json()) as RewardsData & { ok?: boolean };
      if (r.ok !== false) setRewards(r);
    } catch {
      setError("Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const total        = wallet?.total_balance        ?? 0;
  const withdrawable = wallet?.withdrawable_balance ?? 0;
  const bonus        = wallet?.bonus_balance        ?? 0;
  const pending      = wallet?.pending_balance      ?? 0;
  const txns         = wallet?.recent_transactions  ?? [];
  const stones       = milestones(total, withdrawable);
  const unlocked     = rewards?.unlockedCount ?? 0;

  return (
    <div className="min-h-full bg-[#070A0E] pb-8">

      {/* ── Balance hero ── */}
      <BalanceHero
        total={total}
        withdrawable={withdrawable}
        bonus={bonus}
        loading={loading}
      />

      {/* ── Pending notice ── */}
      {!loading && pending > 0 && (
        <div className="mx-4 mt-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/15 px-4 py-2.5">
          <p className="text-[12px] text-amber-400/80">
            {fmt(pending)} pending — clears on next validation cycle
          </p>
        </div>
      )}

      {/* ── Reward unlock banner ── */}
      {!loading && unlocked > 0 && (
        <div className="mx-4 mt-3 rounded-xl bg-violet-500/[0.10] border border-violet-500/20 px-4 py-3 flex items-center gap-3">
          <span className="text-xl">🎁</span>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-violet-300 leading-snug">
              {unlocked} reward{unlocked > 1 ? "s" : ""} unlocked
            </p>
            <p className="text-[11px] text-violet-400/60">
              Go to Scratch Cards to reveal
            </p>
          </div>
          <span className="text-violet-400/40 text-lg">›</span>
        </div>
      )}

      {/* ── Recent Activity ── */}
      <div className="mx-4 mt-5">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-white/30 mb-3">
          Recent Activity
        </p>

        <div className="rounded-2xl bg-[#0e1117] border border-white/[0.07] px-4">
          {loading ? (
            <div className="py-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3"
                  style={{ opacity: 1 - i * 0.15 }}
                >
                  <div className="w-2 h-2 rounded-full bg-white/[0.08]" />
                  <div className="flex-1 h-4 rounded bg-white/[0.05] animate-pulse" />
                  <div className="w-16 h-4 rounded bg-white/[0.05] animate-pulse" />
                </div>
              ))}
            </div>
          ) : txns.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[13px] text-white/25">
                No activity yet — record your first sale to get started
              </p>
            </div>
          ) : (
            txns.map((tx) => <ActivityRow key={tx.id} tx={tx} />)
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5">
            <p className="text-[12px] text-red-400">{error}</p>
            <button
              onClick={() => void load()}
              className="text-[11px] text-[#4FD1FF] mt-1"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* ── Milestones ── */}
      <div className="mx-4 mt-5">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-white/30 mb-3">
          Milestones
        </p>

        <div className="grid grid-cols-2 gap-2">
          {stones.map((m) => (
            <div
              key={m.label}
              className={[
                "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all",
                m.unlocked
                  ? "border-amber-500/30 bg-amber-500/[0.08]"
                  : "border-white/[0.05] bg-white/[0.02] opacity-40",
              ].join(" ")}
            >
              <span className="text-base leading-none">{m.icon}</span>
              <p
                className={`text-[12px] font-medium leading-tight ${
                  m.unlocked ? "text-amber-300" : "text-white/35"
                }`}
              >
                {m.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Refresh ── */}
      <div className="mx-4 mt-6">
        <button
          onClick={() => void load()}
          disabled={loading}
          className="w-full h-11 rounded-2xl border border-white/[0.07] text-[13px] text-white/30 disabled:opacity-40 active:bg-white/[0.04] transition-colors"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
    </div>
  );
}
