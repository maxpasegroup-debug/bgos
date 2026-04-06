"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { roundMoney } from "@/lib/money-items";

type LineRow = { id: string; name: string; qty: string; price: string };

function newLineRow(): LineRow {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `ln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return { id, name: "", qty: "1", price: "" };
}

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

const labelClass = "text-[11px] font-medium uppercase tracking-wider text-white/50";
const inputClass =
  "w-full rounded-xl border border-white/12 bg-black/45 px-3 py-2.5 text-sm text-white outline-none ring-0 transition placeholder:text-white/30 focus:border-[#FFC300]/45";
const sectionTitle = "text-base font-semibold text-white sm:text-lg";
const sectionSub = "mt-1 text-sm text-white/45";

export function BgosQuotationCreateClient({ initialLeadId }: { initialLeadId: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formId = useId();

  const leadId = searchParams.get("leadId") ?? initialLeadId ?? "";

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [leadLoading, setLeadLoading] = useState(Boolean(leadId));
  const [leadError, setLeadError] = useState<string | null>(null);

  const effectiveLeadId = leadId && !leadError ? leadId : "";

  const [lines, setLines] = useState<LineRow[]>(() => [newLineRow()]);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const priceRefs = useRef<(HTMLInputElement | null)[]>([]);

  const syncRefLength = useCallback((n: number) => {
    nameRefs.current.length = n;
    qtyRefs.current.length = n;
    priceRefs.current.length = n;
  }, []);

  useEffect(() => {
    syncRefLength(lines.length);
  }, [lines.length, syncRefLength]);

  useEffect(() => {
    if (!leadId) {
      setLeadLoading(false);
      return;
    }
    let cancelled = false;
    setLeadLoading(true);
    setLeadError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
          credentials: "include",
        });
        const data = (await res.json()) as {
          ok?: boolean;
          lead?: { name?: string; phone?: string };
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.lead) {
          setLeadError(typeof data.error === "string" ? data.error : "Could not load lead");
          setLeadLoading(false);
          return;
        }
        setCustomerName(typeof data.lead.name === "string" ? data.lead.name : "");
        setCustomerPhone(typeof data.lead.phone === "string" ? data.lead.phone : "");
      } catch {
        if (!cancelled) setLeadError("Network error loading lead");
      } finally {
        if (!cancelled) setLeadLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const lineTotals = useMemo(() => {
    return lines.map((row) => {
      const q = Number(row.qty);
      const p = Number(row.price);
      if (!Number.isFinite(q) || !Number.isFinite(p) || q <= 0 || p < 0) return 0;
      return roundMoney(q * p);
    });
  }, [lines]);

  const grandTotal = useMemo(
    () => roundMoney(lineTotals.reduce((s, t) => s + t, 0)),
    [lineTotals],
  );

  function focusNextRowName(index: number) {
    const next = nameRefs.current[index + 1];
    if (next) {
      next.focus();
      return;
    }
    setLines((rows) => {
      const nl = newLineRow();
      const copy = [...rows, nl];
      const idx = copy.length - 1;
      requestAnimationFrame(() => nameRefs.current[idx]?.focus());
      return copy;
    });
  }

  function handleRowKeyDown(
    e: React.KeyboardEvent,
    field: "name" | "qty" | "price",
    index: number,
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (field === "name") {
      qtyRefs.current[index]?.focus();
      return;
    }
    if (field === "qty") {
      priceRefs.current[index]?.focus();
      return;
    }
    focusNextRowName(index);
  }

  function addLine(afterIndex?: number) {
    setLines((rows) => {
      const nl = newLineRow();
      if (afterIndex == null) {
        const copy = [...rows, nl];
        const idx = copy.length - 1;
        requestAnimationFrame(() => nameRefs.current[idx]?.focus());
        return copy;
      }
      const idx = afterIndex + 1;
      const copy = [...rows.slice(0, idx), nl, ...rows.slice(idx)];
      requestAnimationFrame(() => nameRefs.current[idx]?.focus());
      return copy;
    });
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return;
    setLines((rows) => rows.filter((_, i) => i !== index));
  }

  function validateForSubmit(): { items: { name: string; price: number; qty: number }[] } | null {
    setFormError(null);
    const nameTrim = customerName.trim();
    const phoneTrim = customerPhone.trim();

    if (!effectiveLeadId && (!nameTrim || !phoneTrim)) {
      setFormError("Enter customer name and phone, or open this page with a working lead link.");
      return null;
    }

    const items: { name: string; price: number; qty: number }[] = [];
    for (const row of lines) {
      const n = row.name.trim();
      if (!n) continue;
      const q = Number(row.qty);
      const p = Number(row.price);
      if (!Number.isFinite(q) || q <= 0) {
        setFormError(`Invalid quantity for “${n}”.`);
        return null;
      }
      if (!Number.isFinite(p) || p < 0) {
        setFormError(`Invalid price for “${n}”.`);
        return null;
      }
      items.push({ name: n, price: p, qty: q });
    }

    if (items.length === 0) {
      setFormError("Add at least one line item with a name, quantity, and price.");
      return null;
    }

    return { items };
  }

  async function submit(status: "DRAFT" | "SENT") {
    const parsed = validateForSubmit();
    if (!parsed) return;

    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/quotation/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: effectiveLeadId || null,
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          items: parsed.items,
          notes: notes.trim() || null,
          status,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setFormError(typeof data.error === "string" ? data.error : "Could not save quotation");
        return;
      }
      router.push("/bgos/money?tab=quotations&success=quotation");
    } catch {
      setFormError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`mx-auto max-w-4xl px-4 sm:px-6 ${BGOS_MAIN_PAD}`}>
      <div className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/bgos/money?tab=quotations"
            className="text-xs font-medium text-white/50 transition hover:text-[#FFC300]"
          >
            ← Quotations
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">New quotation</h1>
          <p className="mt-1 text-sm text-white/50">Fast builder — save a draft or send in one step.</p>
        </div>
        {leadId ? (
          <span className="inline-flex max-w-full items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
            Lead-linked · <span className="ml-1 truncate font-mono text-white/70">{leadId.slice(0, 12)}…</span>
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
            Walk-in / manual customer
          </span>
        )}
      </div>

      {(leadError && !leadLoading) || formError ? (
        <div
          className="mb-6 rounded-xl border border-amber-500/35 bg-amber-950/35 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          {formError ?? leadError}
        </div>
      ) : null}

      <form
        id={formId}
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          void submit("DRAFT");
        }}
      >
        <DashboardSurface tilt={false} className="p-6 sm:p-8">
          <h2 className={sectionTitle}>Customer</h2>
          <p className={sectionSub}>Prefilled from CRM when you open from a lead.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                className={`${inputClass} mt-2`}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer or company name"
                disabled={leadLoading}
                autoComplete="name"
              />
            </label>
            <label className="block">
              <span className={labelClass}>Phone</span>
              <input
                className={`${inputClass} mt-2`}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Mobile / WhatsApp"
                disabled={leadLoading}
                autoComplete="tel"
                inputMode="tel"
              />
            </label>
          </div>
        </DashboardSurface>

        <DashboardSurface tilt={false} className="p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className={sectionTitle}>Line items</h2>
              <p className={sectionSub}>Quantities and prices — totals compute instantly.</p>
            </div>
            <button
              type="button"
              onClick={() => addLine()}
              className="inline-flex items-center justify-center rounded-xl border border-[#FFC300]/40 bg-[#FFC300]/12 px-4 py-2.5 text-sm font-semibold text-[#FFC300] transition hover:bg-[#FFC300]/18"
            >
              + Add item
            </button>
          </div>

          <div className="mt-6 hidden gap-3 border-b border-white/10 pb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40 sm:grid sm:grid-cols-[1fr_5.5rem_7.5rem_6.5rem_auto]">
            <span>Item</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Price</span>
            <span className="text-right">Total</span>
            <span className="w-10" />
          </div>

          <div className="mt-3 space-y-4 sm:space-y-2">
            {lines.map((row, i) => (
              <div
                key={row.id}
                className="grid gap-3 rounded-xl border border-white/[0.08] bg-black/25 p-4 sm:grid-cols-[1fr_5.5rem_7.5rem_6.5rem_auto] sm:items-end sm:border-0 sm:bg-transparent sm:p-0"
              >
                <label className="block sm:min-w-0">
                  <span className={`${labelClass} sm:sr-only`}>Item name</span>
                  <input
                    ref={(el) => {
                      nameRefs.current[i] = el;
                    }}
                    className={`${inputClass} mt-1 sm:mt-0`}
                    value={row.name}
                    placeholder="Description or SKU"
                    onChange={(e) =>
                      setLines((rs) => rs.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                    }
                    onKeyDown={(e) => handleRowKeyDown(e, "name", i)}
                  />
                </label>
                <label className="block">
                  <span className={`${labelClass} sm:sr-only`}>Qty</span>
                  <input
                    ref={(el) => {
                      qtyRefs.current[i] = el;
                    }}
                    type="number"
                    min={0}
                    step="any"
                    className={`${inputClass} mt-1 text-center tabular-nums sm:mt-0`}
                    value={row.qty}
                    onChange={(e) =>
                      setLines((rs) => rs.map((r, j) => (j === i ? { ...r, qty: e.target.value } : r)))
                    }
                    onKeyDown={(e) => handleRowKeyDown(e, "qty", i)}
                  />
                </label>
                <label className="block">
                  <span className={`${labelClass} sm:sr-only`}>Price</span>
                  <input
                    ref={(el) => {
                      priceRefs.current[i] = el;
                    }}
                    type="number"
                    min={0}
                    step="0.01"
                    className={`${inputClass} mt-1 text-right tabular-nums sm:mt-0`}
                    value={row.price}
                    onChange={(e) =>
                      setLines((rs) => rs.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))
                    }
                    onKeyDown={(e) => handleRowKeyDown(e, "price", i)}
                  />
                </label>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className="text-xs text-white/45 sm:hidden">Line total</span>
                  <span className="text-right text-sm font-semibold tabular-nums text-[#FFC300]/95">
                    {formatInr(lineTotals[i])}
                  </span>
                </div>
                <div className="flex justify-end sm:w-10">
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    disabled={lines.length <= 1}
                    className="rounded-lg px-2 py-1.5 text-xs text-white/50 transition hover:bg-white/[0.06] hover:text-red-300 disabled:opacity-30"
                    aria-label={`Remove line ${i + 1}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/45">
              {lines.filter((l) => l.name.trim()).length} line
              {lines.filter((l) => l.name.trim()).length === 1 ? "" : "s"}
            </p>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-5 py-4 text-right ring-1 ring-emerald-500/15">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/80">
                Grand total
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-emerald-200">
                {formatInr(grandTotal)}
              </p>
            </div>
          </div>
        </DashboardSurface>

        <DashboardSurface tilt={false} className="p-6 sm:p-8">
          <h2 className={sectionTitle}>Notes</h2>
          <p className={sectionSub}>Terms, validity, or internal remarks.</p>
          <textarea
            className={`${inputClass} mt-4 min-h-[8rem] resize-y`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes for the customer PDF…"
          />
        </DashboardSurface>

        <div className="flex flex-col-reverse gap-3 pb-12 sm:flex-row sm:justify-end sm:gap-4">
          <Link
            href="/bgos/money?tab=quotations"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-medium text-white/85 transition hover:border-white/25"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy || leadLoading}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-6 text-sm font-semibold text-white transition hover:border-[#FFC300]/35 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save as draft"}
          </button>
          <button
            type="button"
            disabled={busy || leadLoading}
            onClick={() => void submit("SENT")}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[#FFC300]/45 bg-[#FFC300]/18 px-6 text-sm font-bold text-[#FFC300] shadow-[0_0_24px_rgba(255,195,0,0.12)] transition hover:bg-[#FFC300]/24 disabled:opacity-50"
          >
            Send quotation
          </button>
        </div>
      </form>
    </div>
  );
}
