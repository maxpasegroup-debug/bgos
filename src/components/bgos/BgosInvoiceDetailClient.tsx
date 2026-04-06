"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import {
  formatInrMoney,
  progressTone,
  statusBadgeClass,
  type InvoiceDetailApi,
} from "@/components/bgos/money-invoice-shared";
import { roundMoney } from "@/lib/money-items";

type CompanyProfile = {
  name: string;
  logoUrl: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  billingAddress: string | null;
  gstNumber: string | null;
};

function parseLineItems(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const out: { name: string; qty: number; price: number; lineTotal: number }[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : "";
    const qty = typeof o.qty === "number" ? o.qty : Number(o.qty);
    const price = typeof o.price === "number" ? o.price : Number(o.price);
    let lineTotal = typeof o.lineTotal === "number" ? o.lineTotal : NaN;
    if (!Number.isFinite(lineTotal) && Number.isFinite(qty) && Number.isFinite(price)) {
      lineTotal = qty * price;
    }
    if (!name.trim() || !Number.isFinite(qty) || !Number.isFinite(price) || !Number.isFinite(lineTotal)) {
      continue;
    }
    out.push({
      name: name.trim(),
      qty,
      price,
      lineTotal: roundMoney(lineTotal),
    });
  }
  return out;
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/12 bg-black/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#FFC300]/45";

export function BgosInvoiceDetailClient({ invoiceId }: { invoiceId: string }) {
  const [invoice, setInvoice] = useState<InvoiceDetailApi | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payBusy, setPayBusy] = useState(false);

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Bank");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [invRes, coRes] = await Promise.all([
        fetch(`/api/invoice/${encodeURIComponent(invoiceId)}`, { credentials: "include" }),
        fetch("/api/company/current", { credentials: "include" }),
      ]);
      const invJson = (await invRes.json()) as { ok?: boolean; invoice?: InvoiceDetailApi; error?: string };
      const coJson = (await coRes.json()) as { ok?: boolean; company?: CompanyProfile };

      if (!invRes.ok || !invJson.ok || !invJson.invoice) {
        setError(typeof invJson.error === "string" ? invJson.error : "Invoice not found");
        setInvoice(null);
      } else {
        setInvoice(invJson.invoice);
      }

      if (coRes.ok && coJson.ok && coJson.company) {
        setCompany(coJson.company);
      } else {
        setCompany(null);
      }
    } catch {
      setError("Network error");
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const lines = useMemo(() => (invoice ? parseLineItems(invoice.items) : []), [invoice]);

  const balance = invoice?.balance ?? 0;
  const pctPaid =
    invoice && invoice.totalAmount > 0
      ? Math.min(100, Math.max(0, (invoice.paidAmount / invoice.totalAmount) * 100))
      : 0;

  const maxPay = balance;

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    setPayBusy(true);
    setPayError(null);
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayError("Enter a valid amount.");
      setPayBusy(false);
      return;
    }
    if (amount > maxPay + 1e-9) {
      setPayError(`Maximum is ${formatInrMoney(maxPay)}.`);
      setPayBusy(false);
      return;
    }

    const methodLabels: Record<string, string> = {
      Cash: "Cash",
      Bank: "Bank transfer",
      UPI: "UPI",
    };
    const method = methodLabels[payMethod] ?? payMethod;

    try {
      const res = await fetch("/api/payment/add", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount,
          method,
          date: new Date(payDate + "T12:00:00").toISOString(),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        maxAmount?: number;
        invoice?: InvoiceDetailApi;
      };
      if (!res.ok || !data.ok) {
        if (data.code === "OVERPAY" && typeof data.maxAmount === "number") {
          setPayError(`Overpayment blocked. Maximum: ${formatInrMoney(data.maxAmount)}.`);
        } else {
          setPayError(typeof data.error === "string" ? data.error : "Payment failed");
        }
        return;
      }
      if (data.invoice) {
        setInvoice(data.invoice);
        setPayAmount("");
      } else {
        await loadAll();
      }
    } catch {
      setPayError("Network error");
    } finally {
      setPayBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <div className="h-10 max-w-md animate-pulse rounded-xl bg-white/10" />
        <div className="mt-8 h-40 animate-pulse rounded-xl bg-white/[0.06]" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <p className="text-sm text-red-200" role="alert">
          {error ?? "Missing invoice"}
        </p>
        <Link href="/bgos/money/invoices" className="mt-4 inline-block text-sm text-[#FFC300] hover:underline">
          ← Back to invoices
        </Link>
      </div>
    );
  }

  const canPay = invoice.workflowStatus !== "DRAFT" && balance > 1e-9;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <Link href="/bgos/money/invoices" className="text-xs font-medium text-white/50 transition hover:text-[#FFC300]">
        ← Invoices
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm text-white/45">
            Issued {new Date(invoice.createdAt).toLocaleString("en-IN", { dateStyle: "medium" })}
            {invoice.dueDate ? ` · Due ${new Date(invoice.dueDate).toLocaleDateString("en-IN")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClass(invoice.paymentBucket)}`}
          >
            {invoice.paymentBucket}
          </span>
          <a
            href={`/api/invoice/pdf/${invoice.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-semibold text-white transition hover:border-[#FFC300]/35"
          >
            Download invoice PDF
          </a>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <DashboardSurface tilt={false} className="p-5 sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45">From</h2>
          {company ? (
            <div className="mt-3 text-sm text-white/80">
              <p className="font-semibold text-white">{company.name}</p>
              {company.billingAddress ? (
                <p className="mt-2 whitespace-pre-line text-white/65">{company.billingAddress}</p>
              ) : null}
              <div className="mt-2 space-y-0.5 text-xs text-white/55">
                {company.companyPhone ? <p>Phone: {company.companyPhone}</p> : null}
                {company.companyEmail ? <p>Email: {company.companyEmail}</p> : null}
                {company.gstNumber ? <p>GST: {company.gstNumber}</p> : null}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-white/45">Company profile unavailable — set it under Settings.</p>
          )}
        </DashboardSurface>

        <DashboardSurface tilt={false} className="p-5 sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45">Bill to</h2>
          <p className="mt-3 text-base font-medium text-white">{invoice.customerName}</p>
          <p className="mt-1 text-sm text-white/65">{invoice.customerPhone}</p>
        </DashboardSurface>

        <DashboardSurface tilt={false} className="p-5 sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45">Items</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                  <th className="px-3 py-2 sm:px-4">Item</th>
                  <th className="px-3 py-2 text-right sm:px-4">Qty</th>
                  <th className="px-3 py-2 text-right sm:px-4">Price</th>
                  <th className="px-3 py-2 text-right sm:px-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-white/45">
                      No line items
                    </td>
                  </tr>
                ) : (
                  lines.map((ln, i) => (
                    <tr key={`${ln.name}-${i}`} className="border-b border-white/[0.06] last:border-0">
                      <td className="px-3 py-2.5 text-white sm:px-4">{ln.name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-white/75 sm:px-4">{ln.qty}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-white/75 sm:px-4">
                        {formatInrMoney(ln.price)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-white sm:px-4">
                        {formatInrMoney(ln.lineTotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Total</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">{formatInrMoney(invoice.totalAmount)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/70">Paid</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-200/95">
                {formatInrMoney(invoice.paidAmount)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Balance</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">{formatInrMoney(invoice.balance)}</p>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-1.5 flex justify-between text-[11px] text-white/50">
              <span>Collected</span>
              <span className="tabular-nums">
                {formatInrMoney(invoice.paidAmount)} / {formatInrMoney(invoice.totalAmount)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${progressTone(invoice.paymentBucket)}`}
                initial={false}
                animate={{ width: `${pctPaid}%` }}
                transition={{ type: "spring", stiffness: 220, damping: 28 }}
              />
            </div>
          </div>
        </DashboardSurface>

        <DashboardSurface tilt={false} className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-white">Record payment</h2>
          <p className="mt-1 text-xs text-white/45">
            Allocations update the invoice immediately. Overpayments are blocked.
          </p>

          {payError ? (
            <p className="mt-3 rounded-lg border border-red-500/35 bg-red-950/25 px-3 py-2 text-sm text-red-100" role="alert">
              {payError}
            </p>
          ) : null}

          {!canPay ? (
            <p className="mt-4 text-sm text-white/45">
              {invoice.workflowStatus === "DRAFT"
                ? "Move the invoice out of draft before recording payments."
                : "This invoice is fully paid."}
            </p>
          ) : (
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(e) => void addPayment(e)}>
              <label className="sm:col-span-2">
                <span className="text-[11px] font-medium text-white/50">Amount (max {formatInrMoney(maxPay)})</span>
                <input
                  type="number"
                  min={0}
                  max={maxPay}
                  step="0.01"
                  className={inputClass}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
              </label>
              <label>
                <span className="text-[11px] font-medium text-white/50">Method</span>
                <select
                  className={`${inputClass} cursor-pointer`}
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                  <option value="UPI">UPI</option>
                </select>
              </label>
              <label>
                <span className="text-[11px] font-medium text-white/50">Date</span>
                <input
                  type="date"
                  className={inputClass}
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={payBusy}
                className="sm:col-span-2 inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[#FFC300]/45 bg-[#FFC300]/18 text-sm font-bold text-[#FFC300] transition hover:bg-[#FFC300]/24 disabled:opacity-50"
              >
                {payBusy ? "Saving…" : "Add payment"}
              </button>
            </form>
          )}

          {invoice.payments.length > 0 ? (
            <div className="mt-8 border-t border-white/10 pt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">Payment history</h3>
              <ul className="mt-3 space-y-2">
                {invoice.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2.5 text-sm"
                  >
                    <span className="text-white/55">{new Date(p.date).toLocaleDateString("en-IN")}</span>
                    <span className="font-medium text-white/80">{p.method}</span>
                    <span className="tabular-nums font-semibold text-emerald-200/90">{formatInrMoney(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DashboardSurface>
      </div>
    </div>
  );
}
