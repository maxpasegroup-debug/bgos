"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import { useBgosDashboardContext } from "@/components/bgos/BgosDataProvider";
import {
  formatInrMoney,
  statusBadgeClass,
  type InvoiceApiRow,
} from "@/components/bgos/money-invoice-shared";

const btnPrimary =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#FFC300]/45 bg-[#FFC300]/18 px-5 text-sm font-bold text-[#FFC300] transition hover:bg-[#FFC300]/24 disabled:opacity-50";
const btnGhost =
  "inline-flex min-h-[40px] items-center justify-center rounded-xl border border-white/12 px-4 text-xs font-semibold text-white/90 transition hover:border-[#FFC300]/35";

export function BgosInvoiceListClient({ initialQuotationId }: { initialQuotationId: string | null }) {
  const { trialReadOnly } = useBgosDashboardContext();
  const searchParams = useSearchParams();
  const quotationIdFromUrl = searchParams.get("quotationId") ?? initialQuotationId ?? "";

  const [rows, setRows] = useState<InvoiceApiRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/invoice/list", { credentials: "include" });
      const data = (await res.json()) as {
        ok?: boolean;
        invoices?: InvoiceApiRow[];
        error?: string;
      };
      if (!res.ok || !data.ok || !Array.isArray(data.invoices)) {
        setError(typeof data.error === "string" ? data.error : "Could not load invoices");
        setRows([]);
        return;
      }
      setRows(data.invoices);
    } catch {
      setError("Network error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateFromQuotation(qid: string) {
    if (trialReadOnly) {
      setError("Your free trial has expired. Upgrade to create invoices.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invoice/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationId: qid }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !data.ok) {
        setError(
          data.code === "TRIAL_EXPIRED"
            ? typeof data.error === "string" && data.error.trim()
              ? data.error
              : "Your free trial has expired. Upgrade to continue."
            : typeof data.error === "string"
              ? data.error
              : "Could not create invoice",
        );
        return;
      }
      await load();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      {quotationIdFromUrl ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-[#FFC300]/30 bg-[#FFC300]/[0.06] px-4 py-4 sm:px-5"
        >
          <p className="text-sm text-white/85">
            Generate an invoice from the linked quotation when it is <strong className="text-white">APPROVED</strong>.
          </p>
          <button
            type="button"
            disabled={busy || trialReadOnly}
            className={`${btnPrimary} mt-3`}
            onClick={() => void generateFromQuotation(quotationIdFromUrl)}
          >
            Generate invoice from quotation
          </button>
        </motion.div>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-xl border border-red-500/35 bg-red-950/30 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.06]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <DashboardSurface tilt={false} className="p-8 text-center text-sm text-white/45">
          No invoices yet. Approve a quotation and generate one from{" "}
          <Link href="/bgos/money?tab=quotations" className="text-[#FFC300] underline-offset-2 hover:underline">
            Quotations
          </Link>
          .
        </DashboardSurface>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                <th className="px-4 py-3 sm:px-5">Invoice</th>
                <th className="px-4 py-3 sm:px-5">Customer</th>
                <th className="px-4 py-3 text-right tabular-nums sm:px-5">Total</th>
                <th className="px-4 py-3 text-right tabular-nums sm:px-5">Paid</th>
                <th className="px-4 py-3 text-right tabular-nums sm:px-5">Balance</th>
                <th className="px-4 py-3 sm:px-5">Status</th>
                <th className="px-4 py-3 sm:px-5"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv, idx) => (
                <motion.tr
                  key={inv.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.25) }}
                  className="border-b border-white/[0.06] last:border-0"
                >
                  <td className="px-4 py-3.5 font-medium text-white sm:px-5">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3.5 text-white/75 sm:px-5">
                    <span className="block">{inv.customerName}</span>
                    {inv.customerPhone !== "—" ? (
                      <span className="mt-0.5 block text-xs text-white/45">{inv.customerPhone}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-white sm:px-5">
                    {formatInrMoney(inv.totalAmount)}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-emerald-200/90 sm:px-5">
                    {formatInrMoney(inv.paidAmount)}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-white sm:px-5">
                    {formatInrMoney(inv.balance)}
                  </td>
                  <td className="px-4 py-3.5 sm:px-5">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(inv.paymentBucket)}`}
                    >
                      {inv.paymentBucket}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 sm:px-5">
                    <Link
                      href={`/bgos/money/invoices/${inv.id}${quotationIdFromUrl ? `?fromQuotation=${encodeURIComponent(quotationIdFromUrl)}` : ""}`}
                      className={`${btnGhost} !min-h-0 py-2`}
                    >
                      View details
                    </Link>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
