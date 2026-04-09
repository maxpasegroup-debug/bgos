"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CompanyPlan, CompanySubscriptionStatus } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { planRank } from "@/lib/company-plan-values";
import { fetchStripeCheckoutUrl } from "@/lib/stripe-plan-checkout";
import { BGOS_MAIN_PAD } from "./layoutTokens";
import { useBgosDashboardContext } from "./BgosDataProvider";

const WA_ENTERPRISE =
  "https://wa.me/918089239823?text=Hi%20I%20want%20Enterprise%20BGOS%20demo";

type SubscriptionPayload = {
  planType: CompanyPlan;
  planName: string;
  subscriptionStatus: CompanySubscriptionStatus;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  renewalDate: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
      return status;
  }
}

const cardWrap =
  "rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-sm sm:p-6";
const planTitle = "text-xs font-semibold uppercase tracking-[0.2em] text-[#FFC300]/90";
const featureList = "mt-4 space-y-2 text-sm text-white/75";
const featureLi = "flex gap-2";
const dot = "mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FFC300]/70";

export function BgosSubscriptionPageClient() {
  const { planLockedToBasic } = useBgosDashboardContext();
  const [data, setData] = useState<SubscriptionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proBusy, setProBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/bgos/subscription", { credentials: "include" });
      const j = (await res.json()) as {
        ok?: boolean;
        data?: SubscriptionPayload;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(j.message ?? j.error ?? "Could not load subscription.");
        setData(null);
        return;
      }
      const row = (j as { data?: SubscriptionPayload }).data ?? (j as SubscriptionPayload);
      if (row && row.planType && row.planName && row.subscriptionStatus != null) {
        setData(row as SubscriptionPayload);
      }
    } catch {
      setError("Could not load subscription.");
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startProCheckout = useCallback(async () => {
    if (planLockedToBasic) {
      setError("Plan upgrades are not available in this environment.");
      return;
    }
    setProBusy(true);
    const result = await fetchStripeCheckoutUrl("PRO");
    setProBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    window.location.assign(result.url);
  }, [planLockedToBasic]);

  const rank = data ? planRank(data.planType) : 0;
  const trialDays = data?.trialDaysRemaining ?? null;
  const basicTrialActive =
    data?.planType === CompanyPlan.BASIC &&
    data.subscriptionStatus === CompanySubscriptionStatus.TRIAL &&
    trialDays != null &&
    trialDays > 0;
  const basicExpired =
    data?.planType === CompanyPlan.BASIC &&
    (data.subscriptionStatus === CompanySubscriptionStatus.EXPIRED ||
      (trialDays !== null && trialDays <= 0));

  return (
    <div className={`min-h-0 flex-1 overflow-y-auto ${BGOS_MAIN_PAD} pb-10 pt-6`}>
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
            Billing
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Subscription
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/55">
            Your workspace plan, trial window, and upgrades — aligned with BGOS Basic, Pro, and
            Enterprise.
          </p>
        </motion.div>

        {error ? (
          <p className="mt-6 rounded-xl border border-[#FF3B3B]/25 bg-[#FF3B3B]/[0.08] px-4 py-3 text-sm text-[#ffb4b4]">
            {error}
          </p>
        ) : null}

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className={`mt-8 ${cardWrap}`}
        >
          {!data ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-40 rounded bg-white/10" />
              <div className="h-3 w-64 rounded bg-white/[0.06]" />
              <div className="h-3 w-48 rounded bg-white/[0.06]" />
            </div>
          ) : (
            <>
              <p className={planTitle}>Current plan</p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xl font-semibold text-white">{data.planName}</p>
                  <p className="mt-1 text-sm text-white/60">
                    Status:{" "}
                    <span className="font-medium text-white/85">{statusLabel(data.subscriptionStatus)}</span>
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    Renewal / trial end
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-white/80">
                    {data.subscriptionStatus === CompanySubscriptionStatus.TRIAL ||
                    (data.planType === CompanyPlan.BASIC && data.renewalDate)
                      ? formatDate(data.renewalDate)
                      : "—"}
                  </p>
                </div>
              </div>
            </>
          )}
        </motion.section>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Basic */}
          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className={`${cardWrap} flex flex-col`}
          >
            <div className="border-b border-white/10 pb-4">
              <p className={planTitle}>Basic plan</p>
              <p className="mt-3 text-lg font-semibold text-white">15-day free trial</p>
              <p className="mt-1 text-sm text-white/60">Then ₹6,000 / month</p>
            </div>
            <ul className={featureList}>
              <li className={featureLi}>
                <span className={dot} />
                Manual CRM
              </li>
              <li className={featureLi}>
                <span className={dot} />
                Lead management
              </li>
              <li className={featureLi}>
                <span className={dot} />
                Team management
              </li>
              <li className={featureLi}>
                <span className={dot} />
                Basic analytics
              </li>
            </ul>
            <div className="mt-auto pt-6">
              {basicTrialActive && trialDays != null ? (
                <span className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-center text-sm font-medium text-emerald-200/95">
                  Trial Active ({trialDays} day{trialDays === 1 ? "" : "s"} left)
                </span>
              ) : basicExpired ? (
                <Link
                  href="/bgos/pricing"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 py-2.5 text-sm font-semibold text-[#FFE08A] transition-colors hover:bg-[#FFC300]/16"
                >
                  Upgrade Now
                </Link>
              ) : data?.planType === CompanyPlan.BASIC &&
                data.subscriptionStatus === CompanySubscriptionStatus.ACTIVE ? (
                <span className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-center text-sm font-medium text-white/70">
                  Current plan
                </span>
              ) : (
                <span className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-center text-sm text-white/50">
                  Included with your workspace
                </span>
              )}
            </div>
          </motion.article>

          {/* Pro */}
          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className={`${cardWrap} relative flex flex-col ring-1 ring-[#FFC300]/20`}
          >
            <div className="absolute right-4 top-4 rounded-full bg-[#FFC300]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#FFC300]">
              Popular
            </div>
            <div className="border-b border-white/10 pb-4 pt-6 sm:pt-4">
              <p className={planTitle}>Pro plan</p>
              <p className="mt-3 text-lg font-semibold text-white">₹12,000 / month</p>
              <p className="mt-1 text-sm text-white/55">Full growth stack</p>
            </div>
            <ul className={featureList}>
              <li className={featureLi}>
                <span className={dot} />
                Full automation
              </li>
              <li className={featureLi}>
                <span className={dot} />
                Nexa AI enabled
              </li>
              <li className={featureLi}>
                <span className={dot} />
                Sales Booster
              </li>
              <li className={featureLi}>
                <span className={dot} />
                Smart lead routing
              </li>
              <li className={featureLi}>
                <span className={dot} />
                Performance insights
              </li>
            </ul>
            <div className="mt-auto pt-6">
              {rank >= planRank(CompanyPlan.PRO) ? (
                <span className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-center text-sm font-medium text-white/70">
                  Current plan
                </span>
              ) : (
                <button
                  type="button"
                  disabled={proBusy || planLockedToBasic}
                  onClick={() => void startProCheckout()}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-[#FFC300]/40 bg-gradient-to-r from-[#FF3B3B]/20 to-[#FFC300]/15 px-4 py-2.5 text-sm font-semibold text-[#FFE08A] shadow-[0_0_24px_-8px_rgba(255,195,0,0.4)] transition-opacity disabled:opacity-50"
                >
                  {proBusy ? "Opening checkout…" : "Upgrade to Pro"}
                </button>
              )}
            </div>
          </motion.article>

          {/* Enterprise */}
          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={`${cardWrap} flex flex-col`}
          >
            <div className="border-b border-white/10 pb-4">
              <p className={planTitle}>Enterprise plan</p>
              <p className="mt-3 text-lg font-semibold text-white">Custom pricing</p>
              <p className="mt-1 text-sm text-white/55">Built for scale</p>
            </div>
            <ul className={featureList}>
              <li className={featureLi}>
                <span className={dot} />
                Full company automation
              </li>
              <li className={featureLi}>
                <span className={dot} />
                Dedicated support
              </li>
              <li className={featureLi}>
                <span className={dot} />
                Custom integrations
              </li>
            </ul>
            <div className="mt-auto pt-6">
              {rank >= planRank(CompanyPlan.ENTERPRISE) ? (
                <span className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-center text-sm font-medium text-white/70">
                  Current plan
                </span>
              ) : (
                <a
                  href={WA_ENTERPRISE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/90 transition-colors hover:bg-white/[0.1]"
                >
                  Contact Sales (WhatsApp)
                </a>
              )}
            </div>
          </motion.article>
        </div>

        <p className="mt-8 text-center text-xs text-white/40">
          Compare details on{" "}
          <Link href="/bgos/pricing" className="text-[#FFC300]/80 underline-offset-2 hover:underline">
            Pricing
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
