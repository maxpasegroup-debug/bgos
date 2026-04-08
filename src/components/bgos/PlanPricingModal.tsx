"use client";

import { useCallback, useState } from "react";
import { PLAN, type PaidPlan } from "@/lib/company-plan-values";
import { fetchStripeCheckoutUrl } from "@/lib/stripe-plan-checkout";
import { useBgosDashboardContext } from "./BgosDataProvider";

const LABEL_PRO =
  process.env.NEXT_PUBLIC_BILLING_PRO_LABEL?.trim() || "Pro — subscription (Stripe Checkout)";
const LABEL_ENTERPRISE =
  process.env.NEXT_PUBLIC_BILLING_ENTERPRISE_LABEL?.trim() ||
  "Enterprise — subscription (Stripe Checkout)";

type PlanPricingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PlanPricingModal({ open, onOpenChange }: PlanPricingModalProps) {
  const { companyPlan, planLockedToBasic } = useBgosDashboardContext();
  const [busy, setBusy] = useState<PaidPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = useCallback(async (plan: PaidPlan) => {
    setBusy(plan);
    setError(null);
    try {
      const stripePlan = plan === PLAN.ENTERPRISE ? "ENTERPRISE" : "PRO";
      const result = await fetchStripeCheckoutUrl(stripePlan);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      window.location.assign(result.url);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(null);
    }
  }, []);

  if (!open) return null;

  const disablePro =
    planLockedToBasic || companyPlan === PLAN.PRO || companyPlan === PLAN.ENTERPRISE;
  const disableEnterprise = planLockedToBasic || companyPlan === PLAN.ENTERPRISE;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/12 bg-[#0d1322] p-6 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)] sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Upgrade your workspace</h2>
            <p className="mt-1 text-sm text-white/50">Pay securely via Stripe. Your plan updates right after payment.</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-2 py-1 text-sm text-white/45 transition hover:bg-white/8 hover:text-white/80"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-[#FFC300]/25 bg-[#FFC300]/[0.07] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#FFE08A]/90">Pro</p>
            <p className="mt-1 text-sm text-white/75">{LABEL_PRO}</p>
            <button
              type="button"
              disabled={Boolean(busy) || disablePro}
              onClick={() => void startCheckout(PLAN.PRO)}
              className="mt-4 w-full rounded-xl bg-[#FFC300]/92 py-2.5 text-sm font-semibold text-black transition hover:bg-[#FFC300] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy === PLAN.PRO ? "Redirecting…" : disablePro ? "Current tier or higher" : "Continue to payment — Pro"}
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">Enterprise</p>
            <p className="mt-1 text-sm text-white/70">{LABEL_ENTERPRISE}</p>
            <button
              type="button"
              disabled={Boolean(busy) || disableEnterprise}
              onClick={() => void startCheckout(PLAN.ENTERPRISE)}
              className="mt-4 w-full rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/12 py-2.5 text-sm font-semibold text-[#FFE08A] transition hover:border-[#FFC300]/50 hover:bg-[#FFC300]/18 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy === PLAN.ENTERPRISE
                ? "Redirecting…"
                : disableEnterprise
                  ? "Current tier"
                  : "Continue to payment — Enterprise"}
            </button>
          </div>
        </div>

        {planLockedToBasic ? (
          <p className="mt-4 text-center text-xs text-amber-200/70">
            Upgrades are disabled in this deployment (plan locked to Basic).
          </p>
        ) : null}

        {error ? <p className="mt-4 text-center text-sm text-red-300/90">{error}</p> : null}
      </div>
    </div>
  );
}
