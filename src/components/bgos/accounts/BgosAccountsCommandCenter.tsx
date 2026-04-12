"use client";

import { UserManualCategory } from "@prisma/client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { ViewModuleGuideButton } from "@/components/bgos/ViewModuleGuideButton";

type RangePreset = "today" | "this_month" | "3_months" | "1_year";
type AccountsData = {
  overview: {
    totalRevenue: number;
    collectedAmount: number;
    pendingPayments: number;
    totalExpenses: number;
    netProfit: number;
  };
  invoices: {
    id: string;
    invoiceNumber: string;
    customer: string;
    amount: number;
    paid: number;
    balance: number;
    status: string;
    createdAt: string;
  }[];
  expenses: { id: string; title: string; amount: number; category: string; date: string }[];
  lcoLoans: {
    id: string;
    customerName: string;
    leadId: string;
    loanAmount: number;
    status: "PENDING" | "APPROVED" | "REJECTED";
    notes: string;
  }[];
  trend: { month: string; revenue: number; expenses: number; profit: number }[];
  insights: { insightLines: string[]; suggestionLines: string[] };
};

type InvoiceDetail = {
  invoice: {
    id: string;
    invoiceNumber: string;
    customerName: string;
    totalAmount: number;
    paidAmount: number;
    balance: number;
    status: string;
    payments: { id: string; amount: number; method: string; date: string }[];
  };
};

function inr(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}

function monthStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function SparkTrend({ rows }: { rows: { month: string; profit: number }[] }) {
  const w = 520;
  const h = 150;
  const pad = 10;
  const max = Math.max(...rows.map((r) => r.profit), 1);
  const min = Math.min(...rows.map((r) => r.profit), 0);
  const span = max - min || 1;
  const pts = rows.map((r, i) => ({
    x: pad + (i / Math.max(1, rows.length - 1)) * (w - pad * 2),
    y: 16 + (1 - (r.profit - min) / span) * (h - 36),
    p: r.profit,
  }));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full">
      {pts.slice(0, -1).map((p, i) => {
        const n = pts[i + 1]!;
        const pos = n.p >= p.p;
        return (
          <path
            key={i}
            d={`M ${p.x} ${p.y} L ${n.x} ${n.y}`}
            stroke={pos ? "rgba(52,211,153,0.95)" : "rgba(248,113,113,0.95)"}
            strokeWidth={2.3}
            fill="none"
            strokeLinecap="round"
          />
        );
      })}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.2} fill="rgba(255,255,255,0.85)" />
      ))}
    </svg>
  );
}

export function BgosAccountsCommandCenter() {
  const [range, setRange] = useState<RangePreset>("this_month");
  const [data, setData] = useState<AccountsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("OPERATIONS");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseFilterCategory, setExpenseFilterCategory] = useState("");
  const [expenseFilterMonth, setExpenseFilterMonth] = useState(monthStr());

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const [lcoLeadId, setLcoLeadId] = useState("");
  const [lcoAmount, setLcoAmount] = useState("");
  const [lcoNotes, setLcoNotes] = useState("");
  const [nexaLine, setNexaLine] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        range,
        expenseMonth: expenseFilterMonth,
      });
      if (expenseFilterCategory.trim()) qs.set("expenseCategory", expenseFilterCategory.trim());
      const res = await fetch(`/api/bgos/accounts?${qs.toString()}`, { credentials: "include" });
      const j = (await res.json()) as { data?: AccountsData; message?: string; error?: string };
      if (!res.ok) {
        setError(j.message ?? j.error ?? "Could not load accounts.");
        setData(null);
      } else {
        setData(j.data ?? (j as unknown as AccountsData));
      }
    } catch {
      setError("Could not load accounts.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [expenseFilterCategory, expenseFilterMonth, range]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openInvoice(id: string) {
    setDetailId(id);
    const res = await fetch(`/api/invoice/${encodeURIComponent(id)}`, { credentials: "include" });
    const j = (await res.json()) as InvoiceDetail;
    setDetail(j);
  }
  async function addPayment() {
    if (!detail) return;
    await fetch("/api/payment/add", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: detail.invoice.id,
        amount: Number(paymentAmount),
        method: paymentMethod,
      }),
    });
    setPaymentAmount("");
    await openInvoice(detail.invoice.id);
    await load();
  }
  async function addExpense() {
    await fetch("/api/expense/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: expenseTitle,
        amount: Number(expenseAmount),
        category: expenseCategory,
        date: expenseDate,
      }),
    });
    setExpenseTitle("");
    setExpenseAmount("");
    await load();
  }
  async function addLco() {
    await fetch("/api/bgos/accounts/lco", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: lcoLeadId,
        loanAmount: Number(lcoAmount),
        notes: lcoNotes || undefined,
      }),
    });
    setLcoLeadId("");
    setLcoAmount("");
    setLcoNotes("");
    await load();
  }
  async function setLcoStatus(id: string, status: "PENDING" | "APPROVED" | "REJECTED") {
    await fetch("/api/bgos/accounts/lco", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  const noData =
    (data?.invoices.length ?? 0) === 0 &&
    (data?.expenses.length ?? 0) === 0 &&
    (data?.lcoLoans.length ?? 0) === 0;

  return (
    <div className={`${BGOS_MAIN_PAD} w-full pb-12 pt-5`}>
      <div className="w-full">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Accounts</h1>
              <p className="mt-1 text-sm text-white/60">Manage your money and cash flow</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ViewModuleGuideButton category={UserManualCategory.ACCOUNTS} />
              <Link
                href="/bgos/money/invoices"
                className="rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 py-2 text-sm font-semibold text-[#FFE08A]"
              >
                Create Invoice
              </Link>
              <button
                type="button"
                onClick={() => document.getElementById("expense-form")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/85"
              >
                Add Expense
              </button>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as RangePreset)}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
              >
                <option value="today">Today</option>
                <option value="this_month">This Month</option>
                <option value="3_months">3 Months</option>
                <option value="1_year">Year</option>
              </select>
            </div>
          </div>
        </section>

        {noData ? (
          <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <p className="text-lg font-medium text-white/90">No financial data yet</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link
                href="/bgos/money/invoices"
                className="rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 py-2 text-sm font-semibold text-[#FFE08A]"
              >
                Create first invoice
              </Link>
              <button
                type="button"
                onClick={() => document.getElementById("expense-form")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/85"
              >
                Add expense
              </button>
            </div>
          </section>
        ) : null}

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Total Revenue", inr(data?.overview.totalRevenue ?? 0), ""],
            ["Collected Amount", inr(data?.overview.collectedAmount ?? 0), ""],
            ["Pending Payments", inr(data?.overview.pendingPayments ?? 0), "text-red-300"],
            ["Total Expenses", inr(data?.overview.totalExpenses ?? 0), ""],
            ["Net Profit", inr(data?.overview.netProfit ?? 0), "text-emerald-300"],
          ].map(([label, value, valClass]) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{label}</p>
              <p className={`mt-2 text-2xl font-semibold ${valClass || "text-white"}`}>{value}</p>
            </motion.div>
          ))}
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Invoices</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/50">
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Paid</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">PDF</th>
                </tr>
              </thead>
              <tbody>
                {data?.invoices.map((i) => (
                  <tr key={i.id} className="border-b border-white/5 text-white/80">
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => void openInvoice(i.id)} className="hover:underline">
                        {i.invoiceNumber}
                      </button>
                    </td>
                    <td className="px-3 py-2">{i.customer || "Customer"}</td>
                    <td className="px-3 py-2">{inr(i.amount)}</td>
                    <td className="px-3 py-2">{inr(i.paid)}</td>
                    <td className="px-3 py-2">{i.status}</td>
                    <td className="px-3 py-2">
                      <a href={`/api/invoice/pdf/${i.id}`} target="_blank" rel="noreferrer" className="text-[#FFC300]/90">
                        Download PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="expense-form" className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold text-white">Add Expense</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                placeholder="Title"
                className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
              />
              <input
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="Amount"
                inputMode="decimal"
                className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
              />
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
              />
              <input
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                placeholder="Category"
                className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => void addExpense()}
              className="mt-3 rounded-lg border border-[#FFC300]/35 bg-[#FFC300]/10 px-3 py-2 text-sm font-semibold text-[#FFE08A]"
            >
              Save Expense
            </button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold text-white">Expenses</h2>
            <div className="mt-3 flex gap-2">
              <input
                value={expenseFilterCategory}
                onChange={(e) => setExpenseFilterCategory(e.target.value)}
                placeholder="Category filter"
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
              />
              <input
                type="month"
                value={expenseFilterMonth}
                onChange={(e) => setExpenseFilterMonth(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
              />
              <button type="button" onClick={() => void load()} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/85">
                Apply
              </button>
            </div>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {data?.expenses.map((e) => (
                <div key={e.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-sm text-white">{e.title}</p>
                  <p className="text-xs text-white/60">
                    {inr(e.amount)} · {e.category} · {new Date(e.date).toLocaleDateString("en-IN")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">LCO (Loan Tracking)</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              value={lcoLeadId}
              onChange={(e) => setLcoLeadId(e.target.value)}
              placeholder="Lead ID"
              className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
            />
            <input
              value={lcoAmount}
              onChange={(e) => setLcoAmount(e.target.value)}
              placeholder="Loan amount"
              inputMode="decimal"
              className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
            />
            <input
              value={lcoNotes}
              onChange={(e) => setLcoNotes(e.target.value)}
              placeholder="Notes"
              className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => void addLco()}
            className="mt-3 rounded-lg border border-[#FFC300]/35 bg-[#FFC300]/10 px-3 py-2 text-sm font-semibold text-[#FFE08A]"
          >
            Add LCO Row
          </button>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/50">
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Loan amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {data?.lcoLoans.map((l) => (
                  <tr key={l.id} className="border-b border-white/5 text-white/80">
                    <td className="px-3 py-2">{l.customerName}</td>
                    <td className="px-3 py-2">{inr(l.loanAmount)}</td>
                    <td className="px-3 py-2">
                      <select
                        value={l.status}
                        onChange={(e) => void setLcoStatus(l.id, e.target.value as "PENDING" | "APPROVED" | "REJECTED")}
                        className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">{l.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold text-white">Profit & Reports</h2>
            <p className="mt-1 text-sm text-white/60">Monthly revenue, expenses, and profit trend</p>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <SparkTrend rows={(data?.trend ?? []).map((t) => ({ month: t.month, profit: t.profit }))} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold text-white">Nexa Financial Insights</h2>
            <div className="mt-3 space-y-2">
              {data?.insights.insightLines.map((l) => (
                <p key={l} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
                  {l}
                </p>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {data?.insights.suggestionLines.map((l) => (
                <p key={l} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
                  {l}
                </p>
              ))}
            </div>
            {nexaLine ? <p className="mt-3 text-sm text-[#FFC300]/85">{nexaLine}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setNexaLine("Fix Now: follow up top pending invoices first.")}
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100"
              >
                Fix Now
              </button>
              <button
                type="button"
                onClick={() => setNexaLine("Send Reminder: notify customers with highest balances due.")}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/85"
              >
                Send Reminder
              </button>
            </div>
          </div>
        </section>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>

      {detailId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setDetailId(null)}>
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#0F141E] p-5" onClick={(e) => e.stopPropagation()}>
            {detail ? (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{detail.invoice.invoiceNumber}</h3>
                    <p className="mt-1 text-sm text-white/60">{detail.invoice.customerName || "Customer"}</p>
                  </div>
                  <button type="button" onClick={() => setDetailId(null)} className="text-sm text-white/65">
                    Close
                  </button>
                </div>
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/85">
                  <p>Total: {inr(detail.invoice.totalAmount)}</p>
                  <p>Paid: {inr(detail.invoice.paidAmount)}</p>
                  <p>Balance: {inr(detail.invoice.balance)}</p>
                  <p>Status: {detail.invoice.status}</p>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-white">Add payment</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="Amount"
                      inputMode="decimal"
                      className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                    />
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                    >
                      <option>Cash</option>
                      <option>Bank</option>
                      <option>UPI</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void addPayment()}
                      className="rounded-lg border border-[#FFC300]/35 bg-[#FFC300]/10 px-3 py-2 text-sm font-semibold text-[#FFE08A]"
                    >
                      Add
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-white/50">Overpayment is blocked automatically.</p>
                </div>
                <div className="mt-4 space-y-2">
                  {detail.invoice.payments.map((p) => (
                    <div key={p.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                      <p className="text-sm text-white">
                        {inr(p.amount)} · {p.method}
                      </p>
                      <p className="text-xs text-white/55">{new Date(p.date).toLocaleString("en-IN")}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-28 animate-pulse rounded-xl bg-white/[0.05]" />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
