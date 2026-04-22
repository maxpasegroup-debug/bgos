"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

type SalaryRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  month: string;
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtInr(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function HrSalary() {
  const [rows, setRows] = useState<SalaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/hr/salary/list");
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        salaries?: SalaryRow[];
        error?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Failed to load");
      setRows(Array.isArray(body.salaries) ? body.salaries : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load salary records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitSalary(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim() || !amount || !month) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setAddError("Enter a valid positive amount");
      return;
    }
    setSubmitting(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      const res = await apiFetch("/api/hr/salary/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId.trim(), amount: parsedAmount, month }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        const errMsg = (body as { error?: string }).error;
        throw new Error(errMsg ?? "Failed to create salary record");
      }
      setAddSuccess("Salary record saved.");
      setUserId("");
      setAmount("");
      await load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">{rows.length} records</p>
        <button
          type="button"
          onClick={() => { setAddOpen((o) => !o); setAddError(null); setAddSuccess(null); }}
          className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-200 hover:bg-cyan-500/20"
        >
          {addOpen ? "Close" : "+ Add Salary"}
        </button>
      </div>

      {addOpen && (
        <form
          onSubmit={(e) => void submitSalary(e)}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold">Add / Update Salary</h3>
          <p className="text-xs text-white/50">Enter the employee&apos;s user ID (CUID). You can find it in the Employees tab URL or by inspecting the employee list.</p>
          <div className="space-y-1.5">
            <label className="block text-xs text-white/60 uppercase tracking-wide">Employee User ID *</label>
            <input
              required
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="cuid…"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs text-white/60 uppercase tracking-wide">Amount (₹) *</label>
              <input
                required
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 25000"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs text-white/60 uppercase tracking-wide">Month *</label>
              <input
                required
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          {addError && <p className="text-sm text-rose-300">{addError}</p>}
          {addSuccess && <p className="text-sm text-emerald-300">{addSuccess}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-cyan-600 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save Salary Record"}
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-white/50">Loading…</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {!loading && !error && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-white/50 uppercase tracking-wide">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.userName}</p>
                    <p className="text-xs text-white/50">{r.userEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-white/70">{fmtMonth(r.month)}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-300">{fmtInr(r.amount)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-white/40">
                    No salary records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-cyan-400/50";
