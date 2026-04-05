"use client";

import { PaymentStatus } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { IceconnectWorkspaceView } from "./IceconnectWorkspaceView";
import { IcPanel } from "./IcPanel";

type PaymentRow = {
  id: string;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
};

type PaymentsSummary = {
  totalPaid: number;
  totalPending: number;
  recordCount: number;
};

export function IceconnectAccountsDashboard() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<PaymentStatus>(PaymentStatus.PENDING);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/iceconnect/accounts/payments", { credentials: "include" });
      if (!res.ok) {
        let msg = "Could not load payments.";
        try {
          const j = (await res.json()) as { error?: string };
          if (typeof j.error === "string" && j.error.trim()) msg = j.error;
        } catch {
          /* ignore */
        }
        setErr(msg);
        return;
      }
      const data = (await res.json()) as {
        payments: PaymentRow[];
        summary?: PaymentsSummary;
      };
      setPayments(Array.isArray(data.payments) ? data.payments : []);
      setSummary(
        data.summary &&
          typeof data.summary.totalPaid === "number" &&
          typeof data.summary.totalPending === "number" &&
          typeof data.summary.recordCount === "number"
          ? data.summary
          : null,
      );
    } catch {
      setErr("Network error — check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/iceconnect/accounts/entry", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: n, status }),
      });
      if (!res.ok) {
        setErr("Could not add entry.");
        return;
      }
      setAmount("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <IceconnectWorkspaceView
      title="Accounts"
      subtitle="Company-wide payment register and manual entries."
      loading={loading}
      error={err}
      onRetry={() => void load()}
    >
      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-white/45">Paid (total)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-200">
              ₹{summary.totalPaid.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-white/45">Pending (total)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-amber-200">
              ₹{summary.totalPending.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-white/45">Records</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">{summary.recordCount}</p>
          </div>
        </div>
      ) : null}

      <IcPanel title="New entry">
        <form onSubmit={(e) => void addEntry(e)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="amt" className="text-xs text-white/50">
              Amount (₹)
            </label>
            <input
              id="amt"
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40"
            />
          </div>
          <div>
            <label htmlFor="st" className="text-xs text-white/50">
              Status
            </label>
            <select
              id="st"
              value={status}
              onChange={(e) => setStatus(e.target.value as PaymentStatus)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40 sm:w-40"
            >
              <option value={PaymentStatus.PENDING}>Pending</option>
              <option value={PaymentStatus.PAID}>Paid</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-cyan-500/90 px-5 py-2 text-sm font-medium text-black hover:bg-cyan-400 disabled:opacity-50"
          >
            Add entry
          </button>
        </form>
      </IcPanel>

      <IcPanel title="Payments">
        {payments.length === 0 ? (
          <p className="text-sm text-white/45">No payment records.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 text-white/85">
                    <td className="py-2 pr-4 tabular-nums text-white/60">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">₹{p.amount.toLocaleString("en-IN")}</td>
                    <td className="py-2">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </IcPanel>
    </IceconnectWorkspaceView>
  );
}
