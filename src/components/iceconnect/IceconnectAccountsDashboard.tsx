"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { PaymentStatus } from "@prisma/client";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";
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
  const { company } = useCompanyBranding();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<PaymentStatus>(PaymentStatus.PENDING);
  const [submitting, setSubmitting] = useState(false);

  const submitStyle = {
    background: "linear-gradient(90deg, var(--ice-primary), var(--ice-secondary))",
  } as CSSProperties;

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/iceconnect/accounts/payments", { credentials: "include" });
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
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/iceconnect/accounts/entry", {
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

  const cn = company?.name?.trim() ?? "your company";
  const hero = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-gray-200/90 bg-white/85 p-5 shadow-sm backdrop-blur-md"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--ice-primary)]">
        Accounts · {cn}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-gray-900">Payments & billing register</h2>
      <p className="mt-1 text-sm text-gray-500">
        Track collections and pending amounts for your company in one secure view.
      </p>
    </motion.div>
  );

  return (
    <IceconnectWorkspaceView
      title="Accounts"
      subtitle="Company-wide payment register and manual entries."
      loading={loading}
      error={err}
      onRetry={() => void load()}
      hero={hero}
    >
      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200/90 bg-white/85 px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Paid (total)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-700">
              ₹{summary.totalPaid.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200/90 bg-white/85 px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Pending (total)
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-amber-700">
              ₹{summary.totalPending.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200/90 bg-white/85 px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Records</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
              {summary.recordCount}
            </p>
          </div>
        </div>
      ) : null}

      <IcPanel title="New entry">
        <form onSubmit={(e) => void addEntry(e)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="amt" className="text-xs text-gray-500">
              Amount (₹)
            </label>
            <input
              id="amt"
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[color:var(--ice-primary)] focus:ring-2 focus:ring-[color:var(--ice-primary)]"
            />
          </div>
          <div>
            <label htmlFor="st" className="text-xs text-gray-500">
              Status
            </label>
            <select
              id="st"
              value={status}
              onChange={(e) => setStatus(e.target.value as PaymentStatus)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[color:var(--ice-primary)] sm:w-40"
            >
              <option value={PaymentStatus.PENDING}>Pending</option>
              <option value={PaymentStatus.PAID}>Paid</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
            style={submitStyle}
          >
            Add entry
          </button>
        </form>
      </IcPanel>

      <IcPanel title="Payments">
        {payments.length === 0 ? (
          <p className="text-sm text-gray-500">No payment records.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 text-gray-800">
                    <td className="py-2 pr-4 tabular-nums text-gray-500">
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
