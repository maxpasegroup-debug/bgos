"use client";

import { PaymentStatus } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { IcPanel } from "./IcPanel";

type PaymentRow = {
  id: string;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
};

export function IceconnectAccountsDashboard() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<PaymentStatus>(PaymentStatus.PENDING);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/iceconnect/accounts/payments", { credentials: "include" });
    if (!res.ok) {
      setErr("Could not load payments");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { payments: PaymentRow[] };
    setPayments(data.payments);
    setErr(null);
    setLoading(false);
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
        setErr("Could not add entry");
        return;
      }
      setAmount("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-white/50">Loading payments…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="mt-1 text-sm text-white/50">Company payments and manual entries.</p>
      </div>
      {err ? (
        <p className="text-sm text-red-400" role="alert">
          {err}
        </p>
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
    </div>
  );
}
