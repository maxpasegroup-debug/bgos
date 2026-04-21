"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { apiFetch } from "@/lib/api-fetch";
import { glassPanel, ds } from "@/styles/design-system";
import { useInternalSession } from "./InternalSessionContext";
import { SalesNetworkRole } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "PAID";

type WithdrawalRow = {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  status: WStatus;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
  processedByName: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function relDate(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

const STATUS_META: Record<WStatus, { label: string; color: string; bg: string }> = {
  REQUESTED: { label: "Pending", color: "text-amber-300", bg: "bg-amber-500/15 border-amber-500/30" },
  APPROVED:  { label: "Approved", color: "text-sky-300", bg: "bg-sky-500/15 border-sky-500/30" },
  REJECTED:  { label: "Rejected", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  PAID:      { label: "Paid", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
};

function fadeUp(i = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: i * 0.06 },
  };
}

// ---------------------------------------------------------------------------
// AgreementGate
// ---------------------------------------------------------------------------

function AgreementGate() {
  return (
    <div className={`${glassPanel} p-7 text-center space-y-4`}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
        <span className="text-2xl">📄</span>
      </div>
      <div>
        <h3 className="text-base font-semibold text-white">Agreement Required</h3>
        <p className="mt-1.5 text-sm text-white/40">
          To enable withdrawals, you must accept the BDE Partner Agreement.
        </p>
      </div>
      <Link
        href="/internal/legal/bde-agreement"
        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#4FD1FF] to-[#7C5CFF] px-5 py-2.5 text-sm font-semibold text-black shadow-[0_4px_20px_-4px_rgba(79,209,255,0.35)] hover:opacity-90 transition"
      >
        Read & Accept Agreement →
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RequestForm
// ---------------------------------------------------------------------------

function RequestForm({
  withdrawable,
  onSuccess,
}: {
  withdrawable: number;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const num = parseInt(amount, 10);
    if (isNaN(num) || num <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/internal/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? "Request failed.");
      setDone(true);
      onSuccess();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className={`${glassPanel} p-6 text-center space-y-2`}>
        <span className="text-3xl">✅</span>
        <p className="text-sm font-semibold text-white">Withdrawal requested!</p>
        <p className="text-xs text-white/40">Your request has been submitted and is awaiting boss approval.</p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className={`${glassPanel} p-6 space-y-4`}>
      <div>
        <h3 className="text-sm font-semibold text-white">Request Withdrawal</h3>
        <p className="mt-0.5 text-xs text-white/40">Available: {fmt(withdrawable)}</p>
      </div>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/30">₹</span>
        <input
          type="number"
          min={500}
          max={50000}
          step={1}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (₹500 – ₹50,000)"
          className="w-full rounded-xl border border-white/10 bg-white/[0.05] pl-8 pr-4 py-3 text-sm text-white placeholder-white/25 focus:border-[#4FD1FF]/50 focus:outline-none transition"
        />
      </div>

      {err && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
          {err}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !amount}
        className="w-full rounded-2xl bg-gradient-to-r from-[#4FD1FF] to-[#7C5CFF] py-3 text-sm font-semibold text-black shadow-[0_4px_20px_-4px_rgba(79,209,255,0.3)] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? "Submitting…" : "Submit Request"}
      </button>

      <p className="text-center text-[11px] text-white/25">
        Min ₹500 · Max ₹50,000 · One request at a time
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// AdminPanel (BOSS only)
// ---------------------------------------------------------------------------

function AdminPanel({
  withdrawals,
  onRefresh,
}: {
  withdrawals: WithdrawalRow[];
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pending = withdrawals.filter((w) => w.status === "REQUESTED" || w.status === "APPROVED");

  async function act(id: string, action: "approve" | "pay" | "reject") {
    setBusy(id);
    setErr(null);
    try {
      let res: Response;
      if (action === "reject") {
        const reason = window.prompt("Rejection reason (optional)") ?? "Rejected by admin";
        res = await apiFetch("/api/internal/wallet/withdraw/reject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ withdrawal_id: id, reason }),
        });
      } else {
        res = await apiFetch("/api/internal/wallet/withdraw/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ withdrawal_id: id, mark_paid: action === "pay" }),
        });
      }
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? "Action failed.");
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  if (pending.length === 0) return null;

  return (
    <div className={`${glassPanel} overflow-hidden`}>
      <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Pending Approvals</h3>
          <p className="text-xs text-white/35 mt-0.5">{pending.length} request{pending.length > 1 ? "s" : ""} awaiting action</p>
        </div>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-300">
          {pending.length}
        </span>
      </div>

      {err && (
        <div className="mx-6 mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
          {err}
        </div>
      )}

      <div className="divide-y divide-white/[0.05]">
        {pending.map((w) => {
          const st = STATUS_META[w.status];
          const isBusy = busy === w.id;
          return (
            <div key={w.id} className="flex items-center gap-4 px-6 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{w.userName ?? "Unknown"}</p>
                <p className="text-xs text-white/35 truncate">{w.userEmail}</p>
                <p className="mt-1 text-xs text-white/25">{relDate(w.createdAt)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-bold text-white">{fmt(w.amount)}</p>
                <span className={`inline-block mt-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${st.bg} ${st.color}`}>
                  {st.label}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                {w.status === "REQUESTED" && (
                  <>
                    <button
                      disabled={isBusy}
                      onClick={() => void act(w.id, "approve")}
                      className="rounded-lg bg-sky-500/20 border border-sky-500/30 px-3 py-1.5 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/30 transition disabled:opacity-40"
                    >
                      {isBusy ? "…" : "Approve"}
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => void act(w.id, "reject")}
                      className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-[11px] font-semibold text-red-400 hover:bg-red-500/20 transition disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </>
                )}
                {w.status === "APPROVED" && (
                  <>
                    <button
                      disabled={isBusy}
                      onClick={() => void act(w.id, "pay")}
                      className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/30 transition disabled:opacity-40"
                    >
                      {isBusy ? "…" : "Mark Paid"}
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => void act(w.id, "reject")}
                      className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-[11px] font-semibold text-red-400 hover:bg-red-500/20 transition disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HistoryTable
// ---------------------------------------------------------------------------

function HistoryTable({ withdrawals }: { withdrawals: WithdrawalRow[] }) {
  if (withdrawals.length === 0) {
    return (
      <div className={`${glassPanel} flex flex-col items-center justify-center py-12 text-center`}>
        <span className="text-3xl mb-2">💸</span>
        <p className="text-sm text-white/30">No withdrawal history yet.</p>
      </div>
    );
  }

  return (
    <div className={`${glassPanel} overflow-hidden`}>
      <div className="px-6 pt-5 pb-3 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white">Withdrawal History</h3>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {withdrawals.map((w) => {
          const st = STATUS_META[w.status];
          return (
            <div key={w.id} className="flex items-center gap-4 px-6 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/50">{relDate(w.createdAt)}</p>
                {w.note && w.status === "REJECTED" && (
                  <p className="mt-0.5 text-xs text-red-400/70 truncate">
                    Reason: {w.note}
                  </p>
                )}
                {w.processedByName && (
                  <p className="mt-0.5 text-[11px] text-white/25">
                    by {w.processedByName}
                    {w.processedAt ? ` · ${relDate(w.processedAt)}` : ""}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-white">{fmt(w.amount)}</p>
                <span className={`inline-block mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${st.bg} ${st.color}`}>
                  {st.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WithdrawalPanel (exported)
// ---------------------------------------------------------------------------

type PanelProps = {
  withdrawableBalance: number;
  agreementAccepted: boolean;
  onRefreshWallet: () => void;
};

export function WithdrawalPanel({ withdrawableBalance, agreementAccepted, onRefreshWallet }: PanelProps) {
  const { salesNetworkRole } = useInternalSession();
  const isBoss = salesNetworkRole === SalesNetworkRole.BOSS;

  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const hasPending = withdrawals.some((w) => w.status === "REQUESTED");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/internal/wallet/withdrawals");
      const j = (await res.json()) as { ok?: boolean; withdrawals?: WithdrawalRow[] };
      setWithdrawals(j.withdrawals ?? []);
    } catch {
      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function handleSuccess() {
    void load();
    onRefreshWallet();
  }

  return (
    <div className="space-y-5">
      {/* Agreement gate for non-boss */}
      <AnimatePresence mode="wait">
        {!isBoss && !agreementAccepted ? (
          <motion.div key="gate" {...fadeUp(0)}>
            <AgreementGate />
          </motion.div>
        ) : (
          !isBoss && !hasPending && (
            <motion.div key="form" {...fadeUp(0)}>
              <RequestForm withdrawable={withdrawableBalance} onSuccess={handleSuccess} />
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* Pending request notice for the user */}
      {!isBoss && hasPending && (
        <motion.div {...fadeUp(0)} className={`${glassPanel} flex items-center gap-4 px-6 py-4`}>
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-base">
            ⏳
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Withdrawal pending</p>
            <p className="text-xs text-white/40">Your request is awaiting boss approval. You&apos;ll be notified once processed.</p>
          </div>
        </motion.div>
      )}

      {/* Boss admin panel */}
      {isBoss && !loading && (
        <motion.div {...fadeUp(0)}>
          <AdminPanel withdrawals={withdrawals} onRefresh={handleSuccess} />
        </motion.div>
      )}

      {/* History */}
      <motion.div {...fadeUp(1)}>
        {loading ? (
          <div className={`${glassPanel} flex items-center justify-center py-10`}>
            <span className="text-xs text-white/25 animate-pulse">Loading…</span>
          </div>
        ) : (
          <HistoryTable withdrawals={isBoss ? withdrawals : withdrawals.filter((w) => !("userEmail" in w) || true)} />
        )}
      </motion.div>
    </div>
  );
}
