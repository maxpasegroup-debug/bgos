"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import { useBgosDashboardContext } from "@/components/bgos/BgosDataProvider";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type QuotationRow = {
  id: string;
  leadId: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  quotationNumber: string;
  status: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
};

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

const inputClass =
  "mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#FFC300]/40";
const btnSecondary =
  "inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/90 transition hover:border-[#FFC300]/40";
const btnPrimary =
  "inline-flex items-center justify-center rounded-lg border border-[#FFC300]/40 bg-[#FFC300]/15 px-3 py-2 text-xs font-semibold text-[#FFC300] transition hover:bg-[#FFC300]/20";

export function BgosMoneyPageClient({
  initialLeadId,
  initialQuotationId,
}: {
  initialLeadId: string | null;
  initialQuotationId: string | null;
}) {
  const { trialReadOnly } = useBgosDashboardContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const leadIdFromUrl = searchParams.get("leadId") ?? initialLeadId ?? "";
  const quotationIdFromUrl = searchParams.get("quotationId") ?? initialQuotationId ?? "";

  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const successHandled = useRef(false);

  const loadQuotations = useCallback(async () => {
    setLoadErr(null);
    try {
      const res = await apiFetch("/api/quotation/list");
      const data = (await res.json()) as { ok?: boolean; quotations?: QuotationRow[]; error?: string };
      if (!res.ok || !data.ok || !Array.isArray(data.quotations)) {
        const err =
          typeof data.error === "string" && data.error.trim()
            ? `${data.error} (HTTP ${res.status})`
            : `Load failed (HTTP ${res.status})`;
        setLoadErr(err);
        return;
      }
      setQuotations(data.quotations);
    } catch (e) {
      console.error("API ERROR:", e);
      setLoadErr(formatFetchFailure(e, "Could not reach quotation list API"));
    }
  }, []);

  useEffect(() => {
    void loadQuotations();
  }, [loadQuotations]);

  useEffect(() => {
    if (searchParams.get("success") !== "quotation") {
      successHandled.current = false;
      return;
    }
    if (successHandled.current) return;
    successHandled.current = true;
    setSuccessToast("Quotation saved successfully.");
    void loadQuotations();
    const u = new URL(window.location.href);
    u.searchParams.delete("success");
    const q = u.searchParams.toString();
    window.history.replaceState({}, "", `${u.pathname}${q ? `?${q}` : ""}`);
  }, [searchParams, loadQuotations]);

  async function patchQuotationStatus(id: string, status: string) {
    if (trialReadOnly) {
      setLoadErr("Your free trial has expired. Upgrade to change quotations.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/quotation/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !data.ok) {
        setLoadErr(
          data.code === "TRIAL_EXPIRED"
            ? typeof data.error === "string" && data.error.trim()
              ? data.error
              : "Your free trial has expired. Upgrade to continue."
            : "Could not update status",
        );
        return;
      }
      await loadQuotations();
    } catch (e) {
      console.error("API ERROR:", e);
      setLoadErr(formatFetchFailure(e, "Could not reach quotation status API"));
    } finally {
      setBusy(false);
    }
  }

  async function createInvoiceFromQuotation(quotationId: string) {
    if (trialReadOnly) {
      setLoadErr("Your free trial has expired. Upgrade to create invoices.");
      return;
    }
    setBusy(true);
    setLoadErr(null);
    try {
      const res = await apiFetch("/api/invoice/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !data.ok) {
        setLoadErr(
          data.code === "TRIAL_EXPIRED"
            ? typeof data.error === "string" && data.error.trim()
              ? data.error
              : "Your free trial has expired. Upgrade to continue."
            : typeof data.error === "string"
              ? data.error
              : "Invoice create failed",
        );
        return;
      }
      router.push(`/bgos/money/invoices?quotationId=${encodeURIComponent(quotationId)}`);
    } catch (e) {
      console.error("API ERROR:", e);
      setLoadErr(formatFetchFailure(e, "Could not reach invoice create API"));
    } finally {
      setBusy(false);
    }
  }

  function quotationsHref() {
    const p = new URLSearchParams();
    p.set("tab", "quotations");
    if (leadIdFromUrl) p.set("leadId", leadIdFromUrl);
    if (quotationIdFromUrl) p.set("quotationId", quotationIdFromUrl);
    return `/bgos/money?${p.toString()}`;
  }

  const invoicesHref =
    quotationIdFromUrl.trim().length > 0
      ? `/bgos/money/invoices?quotationId=${encodeURIComponent(quotationIdFromUrl.trim())}`
      : "/bgos/money/invoices";
  const invoicesNavActive = pathname.startsWith("/bgos/money/invoices");
  const expensesNavActive = pathname.startsWith("/bgos/money/expenses");

  const quotationCreateHref =
    leadIdFromUrl.trim().length > 0
      ? `/bgos/money/quotation/create?leadId=${encodeURIComponent(leadIdFromUrl.trim())}`
      : "/bgos/money/quotation/create";

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      {successToast ? (
        <div
          className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100"
          role="status"
        >
          <span>{successToast}</span>
          <button
            type="button"
            className="shrink-0 text-emerald-200/80 hover:text-emerald-100"
            onClick={() => setSuccessToast(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}

      <nav className="mb-8 flex flex-wrap gap-2 border-b border-white/10 pb-4">
        <Link
          href={quotationsHref()}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            !invoicesNavActive && !expensesNavActive
              ? "bg-[#FFC300]/15 text-[#FFC300] ring-1 ring-[#FFC300]/35"
              : "text-white/60 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          Quotations
        </Link>
        <Link
          href={invoicesHref}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            invoicesNavActive
              ? "bg-[#FFC300]/15 text-[#FFC300] ring-1 ring-[#FFC300]/35"
              : "text-white/60 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          Invoices
        </Link>
        <Link
          href="/bgos/money/expenses"
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            expensesNavActive
              ? "bg-[#FFC300]/15 text-[#FFC300] ring-1 ring-[#FFC300]/35"
              : "text-white/60 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          Expenses
        </Link>
      </nav>

      {loadErr ? (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100" role="alert">
          {loadErr}
        </p>
      ) : null}

      <div className="space-y-8">
        <DashboardSurface tilt={false} className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white sm:text-base">Create quotation</h2>
              <p className="mt-1 max-w-prose text-xs text-white/45">
                Use the builder for customer details, line items, and draft vs sent. CRM links pre-fill the lead.
              </p>
            </div>
            {trialReadOnly ? (
              <span
                className={`${btnPrimary} inline-flex min-h-[44px] cursor-not-allowed items-center justify-center px-5 text-sm opacity-45`}
                title="Your trial has expired"
              >
                New quotation
              </span>
            ) : (
              <Link
                href={quotationCreateHref}
                className={`${btnPrimary} inline-flex min-h-[44px] items-center justify-center px-5 text-sm`}
              >
                New quotation
              </Link>
            )}
          </div>
        </DashboardSurface>

        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">All quotations</h3>
          {quotations.length === 0 ? (
            <p className="text-sm text-white/40">No quotations yet.</p>
          ) : (
            quotations.map((q) => (
              <DashboardSurface key={q.id} tilt={false} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-white">{q.quotationNumber}</p>
                    <p className="mt-1 text-xs text-white/45">
                      {new Date(q.createdAt).toLocaleString()} ·{" "}
                      {q.customerName?.trim()
                        ? `${q.customerName}${q.customerPhone ? ` · ${q.customerPhone}` : ""}`
                        : q.leadId
                          ? `Lead ${q.leadId.slice(0, 8)}…`
                          : "No lead"}
                    </p>
                    <p className="mt-2 text-lg font-semibold tabular-nums text-[#FFC300]/90">{formatInr(q.totalAmount)}</p>
                    {q.notes ? <p className="mt-2 max-w-prose text-xs text-white/55">{q.notes}</p> : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <label className="text-[10px] text-white/45">
                      Status
                      <select
                        className={`${inputClass} mt-0.5 min-w-[10rem]`}
                        value={q.status}
                        disabled={busy || trialReadOnly}
                        onChange={(e) => void patchQuotationStatus(q.id, e.target.value)}
                      >
                        {(["DRAFT", "SENT", "APPROVED", "REJECTED"] as const).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <a className={btnSecondary} href={`/api/quotation/pdf/${q.id}`} target="_blank" rel="noreferrer">
                        PDF
                      </a>
                      {q.status === "APPROVED" ? (
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={busy || trialReadOnly}
                          onClick={() => void createInvoiceFromQuotation(q.id)}
                        >
                          Generate invoice
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </DashboardSurface>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
