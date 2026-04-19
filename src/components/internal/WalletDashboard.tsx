"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api-fetch";
import { glassPanel, ds } from "@/styles/design-system";
import { useInternalSession } from "./InternalSessionContext";
import { SalesNetworkRole } from "@prisma/client";
import { WithdrawalPanel } from "./WithdrawalPanel";

// ---------------------------------------------------------------------------
// Types — mirror of GET /api/internal/wallet response (no commission splits)
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

function fadeUp(i = 0) {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay: i * 0.06 },
  };
}

const TYPE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DIRECT:     { label: "Earned",    color: "text-emerald-400", bg: "bg-emerald-500/10",  border: "border-emerald-500/25" },
  RECURRING:  { label: "Recurring", color: "text-cyan-400",    bg: "bg-cyan-500/10",     border: "border-cyan-500/25"    },
  BONUS:      { label: "Bonus",     color: "text-amber-400",   bg: "bg-amber-500/10",    border: "border-amber-500/25"   },
  REWARD:     { label: "Reward",    color: "text-violet-400",  bg: "bg-violet-500/10",   border: "border-violet-500/25"  },
  ADJUSTMENT: { label: "Adjust",    color: "text-white/50",    bg: "bg-white/[0.05]",    border: "border-white/15"       },
  WITHDRAWAL: { label: "Withdrawn", color: "text-red-400",     bg: "bg-red-500/10",      border: "border-red-500/25"     },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING:  { label: "Pending",  color: "text-amber-400/80" },
  APPROVED: { label: "Approved", color: "text-cyan-400"     },
  CREDITED: { label: "Credited", color: "text-emerald-400"  },
  REJECTED: { label: "Rejected", color: "text-red-400"      },
};

// ---------------------------------------------------------------------------
// Big balance stat card
// ---------------------------------------------------------------------------

function BalanceCard({
  label,
  amount,
  sub,
  accent,
  glow,
}: {
  label: string;
  amount: number;
  sub?: string;
  accent: string;
  glow?: string;
}) {
  return (
    <div
      className={`${glassPanel} p-6 flex flex-col gap-1`}
      style={glow ? { boxShadow: glow } : undefined}
    >
      <p className="text-xs font-medium uppercase tracking-widest text-white/40">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${accent}`}>
        {fmt(amount)}
      </p>
      {sub && <p className="text-xs text-white/30">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Milestone rewards panel
// ---------------------------------------------------------------------------

function RewardsPanel({
  total,
  pending,
  withdrawable,
}: {
  total: number;
  pending: number;
  withdrawable: number;
}) {
  const milestones: { label: string; icon: string; unlocked: boolean }[] = [
    { label: "First Earning",    icon: "⚡", unlocked: total > 0        },
    { label: "₹10K Total",       icon: "💫", unlocked: total >= 10000   },
    { label: "₹50K Total",       icon: "🌟", unlocked: total >= 50000   },
    { label: "₹1L Total",        icon: "🔥", unlocked: total >= 100000  },
    { label: "First Withdrawal", icon: "🏦", unlocked: withdrawable > 0 },
    { label: "Recurring Active", icon: "♻️", unlocked: false             },
  ];

  return (
    <div className={`${glassPanel} p-6`}>
      <p className="mb-4 text-sm font-semibold text-white">Milestones</p>
      <div className="grid grid-cols-2 gap-2.5">
        {milestones.map((m) => (
          <div
            key={m.label}
            className={[
              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all",
              m.unlocked
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-white/[0.06] bg-white/[0.02] opacity-45",
            ].join(" ")}
          >
            <span className="text-base">{m.icon}</span>
            <p className={`text-xs font-medium leading-tight ${m.unlocked ? "text-amber-300" : "text-white/40"}`}>
              {m.label}
            </p>
          </div>
        ))}
      </div>

      {pending > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <p className="text-xs text-amber-300/70">
            {fmt(pending)} pending — will be credited after the next validation.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Approve panel (BOSS only)
// ---------------------------------------------------------------------------

type PayoutStats = {
  pendingEarningsCount: number;
  approvedEarningsCount: number;
  pendingWalletTxCount: number;
};

type CycleResult = {
  approved_count: number;
  earnings_approved: number;
  earnings_paid: number;
  recurring_credited: number;
  cycle_errors: number;
};

function ApprovePanel() {
  const { salesNetworkRole } = useInternalSession();
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [result, setResult] = useState<CycleResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (salesNetworkRole !== SalesNetworkRole.BOSS) return null;

  useEffect(() => {
    apiFetch("/api/internal/wallet/approve")
      .then((r) => r.json() as Promise<{ ok?: boolean } & PayoutStats>)
      .then((j) => { if (j.ok !== false) setStats(j); })
      .catch(() => undefined);
  }, []);

  async function runCycle() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await apiFetch("/api/internal/wallet/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string } & CycleResult;
      if (!j.ok) throw new Error(j.error ?? "Cycle failed.");
      setResult(j);
      // Refresh stats
      const sr = await apiFetch("/api/internal/wallet/approve");
      const sj = (await sr.json()) as { ok?: boolean } & PayoutStats;
      if (sj.ok !== false) setStats(sj);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const hasPending = (stats?.pendingEarningsCount ?? 0) > 0 || (stats?.pendingWalletTxCount ?? 0) > 0;

  return (
    <div className={`${glassPanel} p-5 space-y-4`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Boss · Payout Cycle</p>
        <p className="mt-1 text-xs text-white/40">
          Runs the full cycle: recurring → approve earnings → credit wallets.
        </p>
      </div>

      {/* Backlog stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Pending earnings", value: stats.pendingEarningsCount },
            { label: "Approved earnings", value: stats.approvedEarningsCount },
            { label: "Pending wallet tx", value: stats.pendingWalletTxCount },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-center">
              <p className="text-base font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-white/30 leading-tight mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {err && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{err}</p>
      )}

      <button
        onClick={() => void runCycle()}
        disabled={busy || (!hasPending && !busy)}
        className="w-full rounded-xl bg-amber-500/10 border border-amber-500/30 py-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
      >
        {busy ? "Running cycle…" : hasPending ? "Run Payout Cycle" : "No pending items"}
      </button>

      {result && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-emerald-400">✓ Cycle complete</p>
          <p className="text-[11px] text-emerald-400/70">
            {result.earnings_paid} earnings paid · {result.approved_count} wallet txns credited
            {result.recurring_credited > 0 ? ` · ${result.recurring_credited} recurring credits` : ""}
            {result.cycle_errors > 0 ? ` · ${result.cycle_errors} errors` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transaction table
// ---------------------------------------------------------------------------

function TxTable({ rows, loading }: { rows: TxRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className={`${glassPanel} overflow-hidden`}>
        <div className="border-b border-white/[0.07] px-6 py-4">
          <p className="text-sm font-semibold text-white">Recent Activity</p>
        </div>
        <div className="px-6 py-8 text-center text-sm text-white/30 animate-pulse">
          Loading transactions…
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={`${glassPanel} overflow-hidden`}>
        <div className="border-b border-white/[0.07] px-6 py-4">
          <p className="text-sm font-semibold text-white">Recent Activity</p>
        </div>
        <div className="px-6 py-12 text-center text-sm text-white/30">
          No transactions yet — record your first sale to get started.
        </div>
      </div>
    );
  }

  return (
    <div className={`${glassPanel} overflow-hidden`}>
      <div className="border-b border-white/[0.07] px-6 py-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">
          Recent Activity
          <span className="ml-2 rounded-full bg-white/[0.07] px-2 py-0.5 text-xs text-white/40">
            {rows.length}
          </span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.05]">
              <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30">
                Type
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30">
                Amount
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-white/30">
                Status
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const tm = TYPE_META[t.type] ?? TYPE_META.ADJUSTMENT;
              const sm = STATUS_META[t.status] ?? { label: t.status, color: "text-white/40" };
              const isDebit = t.amount < 0;

              return (
                <tr
                  key={t.id}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tm.bg} ${tm.border} ${tm.color}`}
                      >
                        {tm.label}
                      </span>
                      {t.note && (
                        <span className="text-xs text-white/30 hidden sm:block">{t.note}</span>
                      )}
                    </div>
                  </td>
                  <td
                    className={`px-4 py-3.5 text-right font-semibold tabular-nums ${isDebit ? "text-red-400" : tm.color}`}
                  >
                    {isDebit ? "−" : "+"}{fmt(t.amount)}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-xs font-medium ${sm.color}`}>{sm.label}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-xs text-white/30 tabular-nums">
                    {new Date(t.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function WalletDashboard() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [walletRes, agreementRes] = await Promise.all([
        apiFetch("/api/internal/wallet"),
        apiFetch("/api/internal/wallet/agreement"),
      ]);
      const j = (await walletRes.json()) as WalletData & { ok?: boolean };
      if (j.ok !== false) setWallet(j);

      const ag = (await agreementRes.json()) as { ok?: boolean; accepted?: boolean };
      setAgreementAccepted(ag.accepted === true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total        = wallet?.total_balance        ?? 0;
  const withdrawable = wallet?.withdrawable_balance ?? 0;
  const bonus        = wallet?.bonus_balance        ?? 0;
  const pending      = wallet?.pending_balance      ?? 0;
  const txns         = wallet?.recent_transactions  ?? [];

  return (
    <div
      className="min-h-full pb-20 pt-6"
      style={{
        background: `linear-gradient(180deg, ${ds.colors.bgPrimary} 0%, ${ds.colors.bgSecondary} 60%)`,
      }}
    >
      <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div {...fadeUp(0)} className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
              Wallet
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
              Your Earnings
            </h1>
            <p className="mt-1 text-sm text-white/40">
              All amounts are in INR · Pending clears on the next validation
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2 text-xs font-medium text-white/50 hover:bg-white/[0.07] disabled:opacity-40 transition-colors"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </motion.div>

        {/* Balance cards */}
        <motion.div
          {...fadeUp(1)}
          className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          <BalanceCard
            label="Total Balance"
            amount={total}
            sub="Lifetime credited"
            accent="text-white"
            glow="0 0 40px -12px rgba(79,209,255,0.15)"
          />
          <BalanceCard
            label="Available"
            amount={withdrawable}
            sub="Ready to withdraw"
            accent="text-emerald-400"
            glow="0 0 32px -12px rgba(34,197,94,0.18)"
          />
          <BalanceCard
            label="Bonuses"
            amount={bonus}
            sub="Rewards & milestones"
            accent="text-amber-400"
          />
          <BalanceCard
            label="Pending"
            amount={pending}
            sub="Awaiting validation"
            accent="text-white/50"
          />
        </motion.div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            <motion.div {...fadeUp(2)}>
              <TxTable rows={txns} loading={loading} />
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div {...fadeUp(2)}>
              <RewardsPanel total={total} pending={pending} withdrawable={withdrawable} />
            </motion.div>
            <motion.div {...fadeUp(3)}>
              <ApprovePanel />
            </motion.div>
          </div>
        </div>

        {/* Withdrawal section */}
        <motion.div {...fadeUp(4)} className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4FD1FF]/70">
              Withdrawals
            </p>
            <h2 className="mt-1 text-lg font-bold text-white">Request & Track Payouts</h2>
          </div>
          <WithdrawalPanel
            withdrawableBalance={withdrawable}
            agreementAccepted={agreementAccepted}
            onRefreshWallet={() => void load()}
          />
        </motion.div>
      </div>
    </div>
  );
}
