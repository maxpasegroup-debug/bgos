"use client";

import Link from "next/link";
import { CompanyPlan } from "@prisma/client";
import { useCallback, useState } from "react";
import { PRICING } from "@/config/pricing";
import { PLAN, planRank, type PaidPlan } from "@/lib/company-plan-values";
import { fetchStripeCheckoutUrl } from "@/lib/stripe-plan-checkout";
import { postSalesBoosterUpgradeRequest } from "@/lib/sales-booster-client";
import { BGOS_MAIN_PAD } from "./layoutTokens";
import { useBgosDashboardContext } from "./BgosDataProvider";

const LABEL_PRO =
  process.env.NEXT_PUBLIC_BILLING_PRO_LABEL?.trim() || "Billed via Stripe · cancel anytime";
const LABEL_ENTERPRISE =
  process.env.NEXT_PUBLIC_BILLING_ENTERPRISE_LABEL?.trim() || "For larger teams · premium support";

const PRICE_BASIC =
  process.env.NEXT_PUBLIC_BILLING_BASIC_PRICE?.trim() ||
  `₹${PRICING.BASIC.price.toLocaleString("en-IN")}/month`;
const PRICE_PRO = process.env.NEXT_PUBLIC_BILLING_PRO_PRICE?.trim() || "From subscription";
const PRICE_ENTERPRISE = process.env.NEXT_PUBLIC_BILLING_ENTERPRISE_PRICE?.trim() || "From subscription";

type FeatureKey =
  | "crm"
  | "money"
  | "team"
  | "documents"
  | "analytics"
  | "nexa"
  | "booster"
  | "automation"
  | "support";

const COMPARISON: { id: FeatureKey; label: string; basic: boolean; pro: boolean; enterprise: boolean }[] = [
  { id: "crm", label: "Lead pipeline & CRM", basic: true, pro: true, enterprise: true },
  { id: "money", label: "Quotations, invoices & expenses", basic: true, pro: true, enterprise: true },
  { id: "team", label: "Team roles & assignments", basic: true, pro: true, enterprise: true },
  { id: "documents", label: "Document vault", basic: true, pro: true, enterprise: true },
  { id: "analytics", label: "Advanced analytics & trend charts", basic: false, pro: true, enterprise: true },
  { id: "nexa", label: "Nexa insights & guidance", basic: false, pro: true, enterprise: true },
  { id: "booster", label: "Sales Booster & follow-up automation", basic: false, pro: true, enterprise: true },
  { id: "automation", label: "Workflow automation & /api/automation", basic: false, pro: true, enterprise: true },
  { id: "support", label: "Priority support & SLA options", basic: false, pro: false, enterprise: true },
];

function CellIcon({ included }: { included: boolean }) {
  if (included) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden>
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.04] text-white/25" aria-label="Not included">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden>
        <path stroke="currentColor" strokeLinecap="round" strokeWidth={1.5} d="M6 6l12 12M18 6L6 18" />
      </svg>
    </span>
  );
}

export function BgosPricingPageClient() {
  const { companyPlan, planLockedToBasic } = useBgosDashboardContext();
  const [busy, setBusy] = useState<PaidPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [salesBusy, setSalesBusy] = useState(false);
  const [salesMsg, setSalesMsg] = useState<string | null>(null);

  const rank = companyPlan ? planRank(companyPlan) : 0;

  const startCheckout = useCallback(async (plan: PaidPlan) => {
    setBusy(plan);
    setError(null);
    const stripePlan = plan === PLAN.ENTERPRISE ? "ENTERPRISE" : "PRO";
    const result = await fetchStripeCheckoutUrl(stripePlan);
    if (!result.ok) {
      setError(result.message);
      setBusy(null);
      return;
    }
    window.location.assign(result.url);
  }, []);

  const disablePro = planLockedToBasic || rank >= planRank(CompanyPlan.PRO);
  const disableEnterprise = planLockedToBasic || rank >= planRank(CompanyPlan.ENTERPRISE);

  async function onContactSales() {
    setSalesBusy(true);
    setSalesMsg(null);
    try {
      const { ok, message } = await postSalesBoosterUpgradeRequest("Enterprise pricing — pricing page");
      setSalesMsg(message);
      if (ok) window.setTimeout(() => setSalesMsg(null), 8000);
    } catch {
      setSalesMsg("Could not send — try the payment button or email your account manager.");
    } finally {
      setSalesBusy(false);
    }
  }

  return (
    <div className={`pb-20 pt-6 sm:pt-10 ${BGOS_MAIN_PAD}`}>
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFC300]/80">
          BGOS
        </p>
        <h1 className="mt-2 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Plans &amp; pricing
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-white/55 sm:text-base">
          Core CRM on <strong className="font-medium text-white/75">Basic</strong>. Unlock Nexa, Sales Booster, and automation on{" "}
          <strong className="font-medium text-[#FFE08A]/90">Pro</strong>.{" "}
          <strong className="font-medium text-white/75">Enterprise</strong> adds priority support and scale.
        </p>

        {planLockedToBasic ? (
          <p className="mx-auto mt-6 max-w-xl rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-center text-sm text-amber-100/90">
            Upgrades are disabled in this deployment (plan locked to Basic).
          </p>
        ) : null}

        {error ? (
          <p className="mx-auto mt-4 max-w-xl text-center text-sm text-red-300/90" role="alert">
            {error}
          </p>
        ) : null}

        {/* Cards */}
        <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {/* Basic */}
          <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-lg backdrop-blur-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">Basic</p>
            <p className="mt-3 text-3xl font-bold tabular-nums text-white">{PRICE_BASIC}</p>
            <p className="mt-2 text-sm text-white/50">Pipeline, leads, money &amp; documents — get your team on one workspace.</p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-white/70">
              <li className="flex gap-2">
                <span className="text-emerald-400/90">✓</span>
                Full CRM &amp; kanban
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400/90">✓</span>
                Quotations &amp; invoices
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400/90">✓</span>
                Included trial period
              </li>
            </ul>
            <Link
              href="/bgos"
              className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.09]"
            >
              {companyPlan === CompanyPlan.BASIC ? "Back to dashboard" : "View dashboard"}
            </Link>
          </div>

          {/* Pro — recommended */}
          <div className="relative flex flex-col rounded-2xl border-2 border-[#FFC300]/50 bg-gradient-to-b from-[#FFC300]/[0.12] to-black/40 p-6 shadow-[0_0_40px_-12px_rgba(255,195,0,0.35)] sm:p-8">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#FFC300] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black shadow-md">
              Recommended
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#FFE08A]">Pro</p>
            <p className="mt-3 text-3xl font-bold tabular-nums text-white">{PRICE_PRO}</p>
            <p className="mt-2 text-sm text-white/60">{LABEL_PRO}</p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-white/80">
              <li className="flex gap-2">
                <span className="text-[#FFC300]">✓</span>
                Everything in Basic
              </li>
              <li className="flex gap-2">
                <span className="text-[#FFC300]">✓</span>
                Nexa &amp; advanced analytics
              </li>
              <li className="flex gap-2">
                <span className="text-[#FFC300]">✓</span>
                Sales Booster &amp; automation API
              </li>
            </ul>
            <button
              type="button"
              disabled={Boolean(busy) || disablePro}
              onClick={() => void startCheckout(PLAN.PRO)}
              className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#FFC300] text-sm font-bold text-black shadow-[0_0_24px_-4px_rgba(255,195,0,0.45)] transition hover:bg-[#ffcd33] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy === PLAN.PRO ? "Redirecting…" : disablePro ? "Current plan or higher" : "Subscribe — Pro"}
            </button>
          </div>

          {/* Enterprise */}
          <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-lg backdrop-blur-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">Enterprise</p>
            <p className="mt-3 text-3xl font-bold tabular-nums text-white">{PRICE_ENTERPRISE}</p>
            <p className="mt-2 text-sm text-white/50">{LABEL_ENTERPRISE}</p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-white/70">
              <li className="flex gap-2">
                <span className="text-emerald-400/90">✓</span>
                Everything in Pro
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400/90">✓</span>
                Priority support
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400/90">✓</span>
                Scale &amp; governance
              </li>
            </ul>
            <div className="mt-8 flex flex-col gap-2">
              <button
                type="button"
                disabled={Boolean(busy) || disableEnterprise}
                onClick={() => void startCheckout(PLAN.ENTERPRISE)}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-[#FFC300]/45 bg-[#FFC300]/15 text-sm font-bold text-[#FFE08A] transition hover:border-[#FFC300]/60 hover:bg-[#FFC300]/22 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy === PLAN.ENTERPRISE
                  ? "Redirecting…"
                  : disableEnterprise
                    ? "Current plan"
                    : "Subscribe — Enterprise"}
              </button>
              <button
                type="button"
                disabled={salesBusy}
                onClick={() => void onContactSales()}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-white/12 text-sm font-medium text-white/80 transition hover:bg-white/[0.06] disabled:opacity-45"
              >
                {salesBusy ? "Sending…" : "Contact sales"}
              </button>
            </div>
            {salesMsg ? (
              <p className="mt-2 text-center text-xs text-emerald-300/90" role="status">
                {salesMsg}
              </p>
            ) : null}
          </div>
        </div>

        {/* Comparison */}
        <div className="mt-16 sm:mt-20">
          <h2 className="text-center text-xl font-semibold text-white sm:text-2xl">Feature comparison</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-white/45">
            See what unlocks when you move from Basic to Pro and Enterprise.
          </p>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-black/25 shadow-inner [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th scope="col" className="px-4 py-4 font-semibold text-white/90 sm:px-6">
                    Feature
                  </th>
                  <th scope="col" className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider text-white/50 sm:px-5">
                    Basic
                  </th>
                  <th
                    scope="col"
                    className="bg-[#FFC300]/[0.08] px-3 py-4 text-center text-xs font-bold uppercase tracking-wider text-[#FFE08A] sm:px-5"
                  >
                    Pro
                  </th>
                  <th scope="col" className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider text-white/50 sm:px-5">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-b border-white/[0.06] ${i % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"}`}
                  >
                    <th scope="row" className="px-4 py-3.5 font-medium text-white/85 sm:px-6">
                      {row.label}
                    </th>
                    <td className="px-3 py-3.5 text-center sm:px-5">
                      <div className="flex justify-center">
                        <CellIcon included={row.basic} />
                      </div>
                    </td>
                    <td className="bg-[#FFC300]/[0.04] px-3 py-3.5 text-center sm:px-5">
                      <div className="flex justify-center">
                        <CellIcon included={row.pro} />
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-center sm:px-5">
                      <div className="flex justify-center">
                        <CellIcon included={row.enterprise} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-white/35">
          Payments are processed securely. Plan changes apply after successful checkout.
        </p>
      </div>
    </div>
  );
}
