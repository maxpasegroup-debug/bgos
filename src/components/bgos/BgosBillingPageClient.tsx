"use client";


import { apiFetch } from "@/lib/api-fetch";
import { CompanySubscriptionStatus } from "@prisma/client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BGOS_MAIN_PAD } from "./layoutTokens";

type PlanSummary = {
  planName: string;
  amount: string;
  subscriptionStatus: CompanySubscriptionStatus;
  nextBillingDate: string | null;
};

type InvoiceRow = {
  id: string;
  invoiceId: string;
  date: string;
  amount: number;
  status: string;
};

type BillingPayload = {
  planSummary: PlanSummary;
  invoices: InvoiceRow[];
  canViewInvoices: boolean;
};

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function statusPillClass(status: CompanySubscriptionStatus): string {
  switch (status) {
    case CompanySubscriptionStatus.TRIAL:
      return "border-emerald-400/35 bg-emerald-500/10 text-emerald-200/95";
    case CompanySubscriptionStatus.ACTIVE:
      return "border-white/15 bg-white/[0.06] text-white/85";
    case CompanySubscriptionStatus.EXPIRED:
      return "border-[#FF3B3B]/30 bg-[#FF3B3B]/10 text-[#ffb4b4]";
    default:
      return "border-white/10 bg-white/[0.04] text-white/70";
  }
}

function statusLabel(status: CompanySubscriptionStatus): string {
  switch (status) {
    case CompanySubscriptionStatus.TRIAL:
      return "Trial";
    case CompanySubscriptionStatus.ACTIVE:
      return "Active";
    case CompanySubscriptionStatus.EXPIRED:
      return "Expired";
    default:
      return String(status);
  }
}

const surface =
  "rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_0_48px_-16px_rgba(0,0,0,0.55)] backdrop-blur-sm";

export function BgosBillingPageClient() {
  const [data, setData] = useState<BillingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/bgos/billing", { credentials: "include" });
      const j = (await res.json()) as BillingPayload & {
        message?: string;
        error?: string;
        data?: BillingPayload;
      };
      if (!res.ok) {
        setError(j.message ?? j.error ?? "Could not load billing.");
        setData(null);
        return;
      }
      const row = j.data ?? j;
      if (row.planSummary && Array.isArray(row.invoices) && typeof row.canViewInvoices === "boolean") {
        setData(row as BillingPayload);
      } else {
        setData(null);
      }
    } catch {
      setError("Could not load billing.");
      setData(null);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const plan = data?.planSummary;

  return (
    <div className={`min-h-0 flex-1 overflow-y-auto ${BGOS_MAIN_PAD} pb-12 pt-6`}>
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">Finance</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Billing</h1>
            <p className="mt-2 max-w-lg text-sm text-white/50">Workspace plan and issued invoices.</p>
          </div>
          <Link
            href="/bgos/subscription"
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 py-2.5 text-sm font-semibold text-[#FFE08A] transition-colors hover:bg-[#FFC300]/16"
          >
            Upgrade plan
          </Link>
        </motion.div>

        {error ? (
          <p className="mt-6 rounded-xl border border-[#FF3B3B]/25 bg-[#FF3B3B]/[0.08] px-4 py-3 text-sm text-[#ffb4b4]">
            {error}
          </p>
        ) : null}

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          className={`mt-8 ${surface} p-6 sm:p-8`}
        >
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFC300]/85">
            Current plan summary
          </h2>
          {!plan ? (
            <div className="mt-6 animate-pulse space-y-3">
              <div className="h-5 w-48 rounded bg-white/10" />
              <div className="h-4 w-full rounded bg-white/[0.06]" />
              <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
            </div>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">Plan</p>
                <p className="mt-1 text-lg font-semibold text-white">{plan.planName}</p>
                <span
                  className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusPillClass(plan.subscriptionStatus)}`}
                >
                  {statusLabel(plan.subscriptionStatus)}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">Amount</p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-white/85">{plan.amount}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Next billing date
                </p>
                <p className="mt-1 text-sm font-medium text-white/85">
                  {formatDate(plan.nextBillingDate)}
                  {plan.subscriptionStatus === CompanySubscriptionStatus.TRIAL && plan.nextBillingDate ? (
                    <span className="mt-1 block text-xs font-normal text-white/45">Trial ends on this date</span>
                  ) : null}
                  {plan.subscriptionStatus === CompanySubscriptionStatus.EXPIRED && plan.nextBillingDate ? (
                    <span className="mt-1 block text-xs font-normal text-white/45">Previous trial end date</span>
                  ) : null}
                  {plan.subscriptionStatus === CompanySubscriptionStatus.ACTIVE && !plan.nextBillingDate ? (
                    <span className="mt-1 block text-xs font-normal text-white/45">Set when billing is connected</span>
                  ) : null}
                </p>
              </div>
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className={`mt-8 ${surface} overflow-hidden`}
        >
          <div className="border-b border-white/[0.07] px-6 py-5 sm:px-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFC300]/85">
              Payment history
            </h2>
            <p className="mt-1 text-sm text-white/45">Invoices you have raised in BGOS (customer billing).</p>
          </div>

          {!data?.canViewInvoices ? (
            <p className="px-6 py-10 text-center text-sm text-white/50 sm:px-8">
              Invoice history is visible to workspace admins and managers.
            </p>
          ) : data.invoices.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-white/50 sm:px-8">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] text-[11px] font-semibold uppercase tracking-wider text-white/45">
                    <th className="px-6 py-3 sm:px-8">Invoice ID</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Amount</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-6 py-3 text-right sm:px-8">PDF</th>
                  </tr>
                </thead>
                <tbody className="text-white/85">
                  {data.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-white/[0.05] last:border-0">
                      <td className="px-6 py-3.5 font-medium sm:px-8">{inv.invoiceId}</td>
                      <td className="px-3 py-3.5 text-white/70">{formatDate(inv.date)}</td>
                      <td className="px-3 py-3.5 tabular-nums">{formatInr(inv.amount)}</td>
                      <td className="px-3 py-3.5">
                        <span className="text-white/75">{inv.status}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right sm:px-8">
                        <a
                          href={`/api/invoice/pdf/${inv.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-[#FFC300]/90 hover:text-[#FFC300]"
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>

        <p className="mt-8 text-center text-xs text-white/35">
          PDFs use your company profile (logo, GSTIN, address) and payment details from settings.
        </p>
      </div>
    </div>
  );
}
