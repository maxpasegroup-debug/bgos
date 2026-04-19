"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api-fetch";
import { glassPanel, ds } from "@/styles/design-system";

function fadeUp(i = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: i * 0.07 },
  };
}

const CLAUSES = [
  {
    heading: "1. Nature of Engagement",
    body: "I understand that I am engaged as a Business Development Executive (BDE) under BGOS as an independent channel partner, and not as a full-time employee. My earnings are commission-based and tied to verified subscriptions.",
  },
  {
    heading: "2. Commission Eligibility",
    body: "Commissions are credited only for active subscriptions that remain in good standing. BGOS reserves the right to reverse credits for cancelled, refunded, or fraudulent subscriptions.",
  },
  {
    heading: "3. Withdrawal Policy",
    body: "Withdrawals are subject to approval by BGOS management. All requests are reviewed within 5 business days. BGOS may request supporting documentation before releasing funds.",
  },
  {
    heading: "4. Code of Conduct",
    body: "I agree to represent BGOS professionally, not misrepresent products, and not engage in any fraudulent sales practices. Violations may result in termination of engagement and forfeiture of pending earnings.",
  },
  {
    heading: "5. Confidentiality",
    body: "I agree to keep confidential all internal commission rates, pricing structures, client data, and BGOS proprietary information. This obligation survives termination of my engagement.",
  },
  {
    heading: "6. Tax Compliance",
    body: "I am solely responsible for declaring and paying any applicable taxes on commissions received. BGOS may deduct TDS as required by law and will issue the appropriate documentation.",
  },
  {
    heading: "7. Amendments",
    body: "BGOS may update these terms with 14 days' notice. Continued use of the platform after notice constitutes acceptance of the updated terms.",
  },
];

export function BdeAgreementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("from") ?? "/internal/sales";

  const [loading, setLoading]               = useState(true);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [checked, setChecked]               = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/internal/wallet/agreement");
      const j   = (await res.json()) as { ok?: boolean; accepted?: boolean };
      if (j.accepted) setAlreadyAccepted(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void checkStatus(); }, [checkStatus]);

  async function handleAccept() {
    if (!checked) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/internal/wallet/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? "Failed to accept agreement.");
      // Navigate to the original destination (or dashboard default)
      router.replace(returnTo);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="animate-pulse text-sm text-white/30">Loading…</span>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Already accepted — forward immediately
  // -------------------------------------------------------------------------

  if (alreadyAccepted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
        <div className={`${glassPanel} max-w-md p-8 text-center`}>
          <span className="text-3xl">✅</span>
          <h1 className="mt-3 text-xl font-bold text-white">Agreement already accepted</h1>
          <p className="mt-2 text-sm text-white/40">
            You have already accepted the BGOS Partner Agreement.
          </p>
          <button
            onClick={() => router.replace(returnTo)}
            className="mt-5 rounded-xl bg-[#4FD1FF]/10 border border-[#4FD1FF]/20 px-5 py-2.5 text-sm font-semibold text-[#4FD1FF] hover:bg-[#4FD1FF]/20 transition"
          >
            Continue to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Agreement form
  // -------------------------------------------------------------------------

  return (
    <div
      className="min-h-full pb-24 pt-6"
      style={{ background: `linear-gradient(180deg, ${ds.colors.bgPrimary} 0%, ${ds.colors.bgSecondary} 60%)` }}
    >
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div {...fadeUp(0)} className="mb-7">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
            Required before proceeding
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            BGOS Partner Agreement
          </h1>
          <p className="mt-1.5 text-sm text-white/40">
            You must read and accept this agreement to access your dashboard.
          </p>
        </motion.div>

        {/* Notice banner */}
        <motion.div
          {...fadeUp(0)}
          className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4"
        >
          <span className="mt-0.5 text-base">⚠️</span>
          <p className="text-sm text-amber-300/80 leading-relaxed">
            Dashboard access is <span className="font-semibold text-amber-300">blocked</span> until
            you accept the BGOS Partner Agreement. This is a one-time step.
          </p>
        </motion.div>

        {/* Clauses */}
        <motion.div {...fadeUp(1)} className={`${glassPanel} mb-6 divide-y divide-white/[0.06]`}>
          {CLAUSES.map((c, i) => (
            <div key={i} className="px-6 py-5">
              <h2 className="mb-1.5 text-sm font-semibold text-white">{c.heading}</h2>
              <p className="text-sm leading-relaxed text-white/50">{c.body}</p>
            </div>
          ))}
        </motion.div>

        {/* Consent block */}
        <motion.div {...fadeUp(2)} className={`${glassPanel} space-y-5 p-6`}>
          {/* Checkbox */}
          <label className="flex cursor-pointer items-start gap-3.5 group">
            <div
              onClick={() => setChecked((v) => !v)}
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-all ${
                checked
                  ? "border-[#4FD1FF] bg-[#4FD1FF]"
                  : "border-white/20 bg-white/[0.04] group-hover:border-white/40"
              }`}
            >
              {checked && (
                <svg className="h-3 w-3 text-black" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="2,6 5,9 10,3" />
                </svg>
              )}
            </div>
            <span
              className="text-sm leading-relaxed text-white/70"
              onClick={() => setChecked((v) => !v)}
            >
              I agree to BGOS terms and the Partner Agreement above. I confirm I have read all
              clauses and that the information I provide is accurate.
            </span>
          </label>

          {/* Error */}
          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              {error}
            </p>
          )}

          {/* Accept button */}
          <button
            disabled={!checked || submitting}
            onClick={() => void handleAccept()}
            className={`w-full rounded-2xl px-6 py-3.5 text-sm font-semibold transition-all ${
              checked && !submitting
                ? "bg-gradient-to-r from-[#4FD1FF] to-[#7C5CFF] text-black shadow-[0_4px_24px_-4px_rgba(79,209,255,0.4)] hover:opacity-90"
                : "cursor-not-allowed bg-white/[0.05] text-white/30"
            }`}
          >
            {submitting ? "Saving…" : "I Accept — Access Dashboard"}
          </button>

          <p className="text-center text-[11px] text-white/25">
            Your acceptance is timestamped and stored. This is a legally binding agreement.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
