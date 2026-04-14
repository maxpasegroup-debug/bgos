"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LeadStatus } from "@prisma/client";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { BgosDocumentsClient } from "@/components/bgos/BgosDocumentsClient";
import { useBgosDashboardContext } from "@/components/bgos/BgosDataProvider";
import type { InvoiceApiRow } from "@/components/bgos/money-invoice-shared";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type LeadPayload = {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  statusLabel: string;
  value: number | null;
  assignedTo: string | null;
  assignee: { id: string; name: string; email: string } | null;
};

type QuotationRow = {
  id: string;
  quotationNumber: string;
  status: string;
  totalAmount: number;
};

const btnPrimary =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#FFC300]/45 bg-[#FFC300]/18 px-4 text-sm font-bold text-[#FFC300] transition hover:bg-[#FFC300]/24 disabled:opacity-50";
const btnGhost =
  "inline-flex min-h-[40px] items-center justify-center rounded-xl border border-white/12 px-4 text-xs font-semibold text-white/90 transition hover:border-[#FFC300]/35";

export function BgosLeadDetailClient({ leadId }: { leadId: string }) {
  const { trialReadOnly } = useBgosDashboardContext();
  const [lead, setLead] = useState<LeadPayload | null>(null);
  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceApiRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [lr, qr, ir] = await Promise.all([
        apiFetch(`/api/leads/${encodeURIComponent(leadId)}`),
        apiFetch(`/api/quotation/list?leadId=${encodeURIComponent(leadId)}`),
        apiFetch(`/api/invoice/list?leadId=${encodeURIComponent(leadId)}`),
      ]);
      const lj = (await lr.json()) as { ok?: boolean; lead?: LeadPayload; error?: string };
      const qj = (await qr.json()) as { ok?: boolean; quotations?: QuotationRow[] };
      const ij = (await ir.json()) as { ok?: boolean; invoices?: InvoiceApiRow[] };

      if (!lr.ok || !lj.ok || !lj.lead) {
        setLead(null);
        const msg =
          typeof lj.error === "string" && lj.error.trim()
            ? `${lj.error} (HTTP ${lr.status})`
            : `Lead not found (HTTP ${lr.status})`;
        setError(msg);
        return;
      }
      setLead(lj.lead);
      setQuotations(Array.isArray(qj.quotations) ? qj.quotations : []);
      setInvoices(Array.isArray(ij.invoices) ? ij.invoices : []);
    } catch (e) {
      console.error("API ERROR:", e);
      setLead(null);
      setError(formatFetchFailure(e, "Could not reach lead API"));
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeQuotation = quotations.find((q) => q.status !== "REJECTED") ?? null;
  const latestInvoice = invoices[0] ?? null;

  async function generateInvoice() {
    if (trialReadOnly) {
      setError("Your free trial has expired. Upgrade to create invoices.");
      return;
    }
    if (!activeQuotation || activeQuotation.status !== "APPROVED") return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/invoice/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationId: activeQuotation.id }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        invoiceId?: string;
        invoice?: { id: string };
      };
      if (!res.ok || !data.ok) {
        if (data.code === "DUPLICATE" && typeof data.invoiceId === "string") {
          window.location.href = `/bgos/money/invoices/${data.invoiceId}`;
          return;
        }
        if (data.code === "TRIAL_EXPIRED") {
          setError(
            typeof data.error === "string" && data.error.trim()
              ? data.error
              : "Your free trial has expired. Upgrade to continue.",
          );
          return;
        }
        setError(typeof data.error === "string" ? data.error : "Could not create invoice");
        return;
      }
      const invId = data.invoice?.id;
      if (invId) {
        window.location.href = `/bgos/money/invoices/${invId}`;
        return;
      }
      await load();
    } catch (e) {
      console.error("API ERROR:", e);
      setError(formatFetchFailure(e, "Could not reach invoice create API"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className={`mx-auto max-w-3xl px-4 py-20 sm:px-6 ${BGOS_MAIN_PAD}`}>
        <div className="h-10 max-w-md animate-pulse rounded-xl bg-white/10" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className={`mx-auto max-w-3xl px-4 py-16 sm:px-6 ${BGOS_MAIN_PAD}`}>
        <p className="text-sm text-red-200" role="alert">
          {error ?? "Missing lead"}
        </p>
        <Link href="/bgos" className="mt-4 inline-block text-sm text-[#FFC300] hover:underline">
          ← Back to command center
        </Link>
      </div>
    );
  }

  const showCreateQuotation = !activeQuotation;
  const showQuotationBlock = !!activeQuotation;
  const showGenerateInvoice = activeQuotation?.status === "APPROVED" && !latestInvoice;
  const showInvoiceBlock = !!latestInvoice;

  return (
    <div className={`mx-auto max-w-3xl px-4 sm:px-6 ${BGOS_MAIN_PAD}`}>
      <Link href="/bgos" className="text-xs font-medium text-white/50 transition hover:text-[#FFC300]">
        ← Command center
      </Link>

      <div className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">{lead.name}</h1>
        <p className="mt-1 text-sm text-white/55">
          {lead.phone}
          {lead.assignee ? ` · ${lead.assignee.name}` : ""}
        </p>
        <p className="mt-2 inline-flex rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/80">
          {lead.statusLabel}
        </p>
      </div>

      <DashboardSurface tilt={false} className="mt-8 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Financial actions</h2>
        <p className="mt-1 text-xs text-white/45">
          Lead → quotation → invoice → payment. Links stay scoped to this company.
        </p>

        <div className="mt-6 space-y-4">
          {showCreateQuotation && !latestInvoice ? (
            <p className="rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/65">
              Start by creating a quotation for this lead. You can send it for approval, then generate a
              single invoice from the approved quote.
            </p>
          ) : null}

          {showCreateQuotation ? (
            trialReadOnly ? (
              <span
                className={`${btnPrimary} cursor-not-allowed opacity-45`}
                title="Your trial has expired"
              >
                Create quotation
              </span>
            ) : (
              <Link
                href={`/bgos/money/quotation/create?leadId=${encodeURIComponent(lead.id)}`}
                className={btnPrimary}
              >
                Create quotation
              </Link>
            )
          ) : null}

          {showQuotationBlock ? (
            <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Quotation
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {activeQuotation!.quotationNumber}
                <span className="ml-2 text-xs font-normal text-[#FFC300]/90">
                  {activeQuotation!.status}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/api/quotation/pdf/${activeQuotation!.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={btnGhost}
                >
                  PDF
                </a>
                <Link href="/bgos/money?tab=quotations" className={btnGhost}>
                  Open in Money
                </Link>
              </div>
            </div>
          ) : null}

          {showGenerateInvoice ? (
            <button
              type="button"
              disabled={busy || trialReadOnly}
              className={btnPrimary}
              onClick={() => void generateInvoice()}
            >
              {busy ? "Working…" : "Generate invoice"}
            </button>
          ) : null}

          {showInvoiceBlock ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/60">
                Invoice
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {latestInvoice!.invoiceNumber}
                <span className="ml-2 text-xs font-normal text-white/55">
                  {latestInvoice!.paymentBucket}
                </span>
              </p>
              <Link
                href={`/bgos/money/invoices/${latestInvoice!.id}`}
                className={`${btnGhost} mt-3 border-emerald-500/30 text-emerald-100`}
              >
                View invoice
              </Link>
            </div>
          ) : null}
        </div>
      </DashboardSurface>

      <div className="mt-8">
        <BgosDocumentsClient embeddedLeadId={lead.id} compact />
      </div>
    </div>
  );
}
