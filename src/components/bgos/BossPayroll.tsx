"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

type PayrollResponse = {
  currentMonth: string;
  bdms: Array<{
    bdmUserId: string;
    bdmName: string;
    bdmEmail: string;
    direct: number;
    recurring: number;
    enterprise: number;
    total: number;
    status: "PENDING" | "APPROVED" | "PAID";
    earningIds: string[];
  }>;
  totals: {
    totalPending: number;
    totalApproved: number;
    totalPaid: number;
    grandTotal: number;
  };
  availableMonths: string[];
  bdmOptions: Array<{ id: string; name: string; email: string }>;
  clientOptions: Array<{ id: string; name: string }>;
};

type BonusForm = {
  clientCompanyId: string;
  bdmUserId: string;
  amount: string;
  type: "DIRECT" | "RECURRING";
  notes: string;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonth(month: string): string {
  const [year, monthPart] = month.split("-");
  const parsed = new Date(Number(year), Number(monthPart) - 1, 1);
  if (Number.isNaN(parsed.getTime())) return month;
  return parsed.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function BossPayroll() {
  const [data, setData] = useState<PayrollResponse | null>(null);
  const [month, setMonth] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusError, setBonusError] = useState<string | null>(null);
  const [bonusForm, setBonusForm] = useState<BonusForm>({
    clientCompanyId: "",
    bdmUserId: "",
    amount: "",
    type: "DIRECT",
    notes: "",
  });

  const load = useCallback(
    async (targetMonth?: string) => {
      setLoading(true);
      setError(null);
      try {
        const query = targetMonth ? `?month=${encodeURIComponent(targetMonth)}` : "";
        const res = await apiFetch(`/api/boss/payroll${query}`, { credentials: "include" });
        const body = (await res.json()) as PayrollResponse & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Could not load payroll.");
        setData(body);
        setMonth(body.currentMonth);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load payroll.");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!bonusOpen || !data) return;
    setBonusForm((current) => ({
      clientCompanyId: current.clientCompanyId || data.clientOptions[0]?.id || "",
      bdmUserId: current.bdmUserId || data.bdmOptions[0]?.id || "",
      amount: current.amount,
      type: current.type,
      notes: current.notes,
    }));
  }, [bonusOpen, data]);

  const summaryCards = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Total Earned", value: formatCurrency(data.totals.grandTotal) },
      { label: "Pending Approval", value: formatCurrency(data.totals.totalPending) },
      { label: "Approved", value: formatCurrency(data.totals.totalApproved) },
      { label: "Paid Out", value: formatCurrency(data.totals.totalPaid) },
    ];
  }, [data]);

  async function runAction(action: "APPROVE" | "MARK_PAID", payload: Record<string, unknown>, key: string) {
    setBusyKey(key);
    try {
      const res = await apiFetch("/api/boss/payroll", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, month, ...payload }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Could not ${action.toLowerCase()}.`);
      await load(month);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update payroll.");
    } finally {
      setBusyKey(null);
    }
  }

  async function submitEnterpriseBonus() {
    setBusyKey("bonus");
    setBonusError(null);
    try {
      const amount = Number(bonusForm.amount);
      const res = await apiFetch("/api/boss/enterprise-bonus", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCompanyId: bonusForm.clientCompanyId,
          bdmUserId: bonusForm.bdmUserId,
          amount,
          type: bonusForm.type,
          notes: bonusForm.notes,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not add enterprise bonus.");
      setBonusOpen(false);
      setBonusForm({
        clientCompanyId: data?.clientOptions[0]?.id ?? "",
        bdmUserId: data?.bdmOptions[0]?.id ?? "",
        amount: "",
        type: "DIRECT",
        notes: "",
      });
      await load(month);
    } catch (e) {
      setBonusError(e instanceof Error ? e.message : "Could not add enterprise bonus.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">BDM Payroll</h3>
          <p className="text-sm text-white/60">Pure performance pay. Direct wins plus recurring retention income.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              void load(e.target.value);
            }}
            className="rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
          >
            {data?.availableMonths.map((option) => (
              <option key={option} value={option}>
                {formatMonth(option)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setBonusOpen(true)}
            className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/15"
          >
            + Add Enterprise Bonus
          </button>
          <button
            type="button"
            onClick={() => void runAction("APPROVE", { approveAll: true }, "approve-all")}
            disabled={busyKey !== null}
            className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyKey === "approve-all" ? "Approving..." : "Approve All"}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">Payroll for {month ? formatMonth(month) : "this month"}</p>
            <p className="text-xs text-white/55">Approve pending rows before marking approved payouts as paid.</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-white/65">Loading payroll...</p>
        ) : !data || data.bdms.length === 0 ? (
          <p className="text-sm text-white/65">No BDM earnings recorded for this month yet.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1.3fr_repeat(4,0.8fr)_1fr] gap-3 px-3 text-[11px] uppercase tracking-[0.14em] text-white/45">
              <span>BDM</span>
              <span>Direct</span>
              <span>Recurring</span>
              <span>Enterprise</span>
              <span>Total</span>
              <span>Action</span>
            </div>
            {data.bdms.map((row) => (
              <div key={row.bdmUserId} className="grid grid-cols-[1.3fr_repeat(4,0.8fr)_1fr] items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-white">{row.bdmName}</p>
                  <p className="text-xs text-white/55">{row.bdmEmail}</p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      row.status === "PAID"
                        ? "border border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                        : row.status === "APPROVED"
                          ? "border border-amber-300/30 bg-amber-500/10 text-amber-100"
                          : "border border-rose-300/30 bg-rose-500/10 text-rose-100"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
                <span className="text-white/85">{formatCurrency(row.direct)}</span>
                <span className="text-white/85">{formatCurrency(row.recurring)}</span>
                <span className="text-white/85">{formatCurrency(row.enterprise)}</span>
                <span className="font-semibold text-white">{formatCurrency(row.total)}</span>
                <div className="flex flex-wrap justify-end gap-2">
                  {row.status !== "PAID" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          row.status === "PENDING" ? "APPROVE" : "MARK_PAID",
                          { bdmUserId: row.bdmUserId },
                          `${row.status}-${row.bdmUserId}`,
                        )
                      }
                      disabled={busyKey !== null}
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyKey === `${row.status}-${row.bdmUserId}`
                        ? row.status === "PENDING"
                          ? "Approving..."
                          : "Marking..."
                        : row.status === "PENDING"
                          ? "Approve"
                          : "Mark as Paid"}
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-200">Paid</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {bonusOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-white">Add Enterprise Bonus</p>
                <p className="mt-1 text-sm text-white/60">Manual bonus entry is auto-approved because a boss is adding it directly.</p>
              </div>
              <button
                type="button"
                onClick={() => setBonusOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/75 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm text-white/70">
                BDM
                <select
                  value={bonusForm.bdmUserId}
                  onChange={(e) => setBonusForm((current) => ({ ...current, bdmUserId: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                >
                  {data?.bdmOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm text-white/70">
                Client
                <select
                  value={bonusForm.clientCompanyId}
                  onChange={(e) => setBonusForm((current) => ({ ...current, clientCompanyId: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                >
                  {data?.clientOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm text-white/70">
                Amount
                <input
                  type="number"
                  min={1}
                  value={bonusForm.amount}
                  onChange={(e) => setBonusForm((current) => ({ ...current, amount: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="grid gap-1 text-sm text-white/70">
                Type
                <select
                  value={bonusForm.type}
                  onChange={(e) =>
                    setBonusForm((current) => ({
                      ...current,
                      type: e.target.value as "DIRECT" | "RECURRING",
                    }))
                  }
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                >
                  <option value="DIRECT">Direct</option>
                  <option value="RECURRING">Recurring</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm text-white/70 sm:col-span-2">
                Notes
                <textarea
                  value={bonusForm.notes}
                  onChange={(e) => setBonusForm((current) => ({ ...current, notes: e.target.value }))}
                  className="min-h-28 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                />
              </label>
            </div>

            {bonusError ? <p className="mt-3 text-sm text-rose-200">{bonusError}</p> : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBonusOpen(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitEnterpriseBonus()}
                disabled={busyKey === "bonus"}
                className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyKey === "bonus" ? "Adding..." : "Add Bonus"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
