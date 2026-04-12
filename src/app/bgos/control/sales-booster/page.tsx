"use client";

import Link from "next/link";
import { useBgosDashboardContext } from "@/components/bgos/BgosDataProvider";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";

export default function ControlSalesBoosterPage() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const { hasProPlan, planLockedToBasic, bossBillingBypass } = useBgosDashboardContext();
  const unlocked = bossBillingBypass || (!planLockedToBasic && hasProPlan);

  const cardShell = light
    ? "rounded-2xl border border-slate-200/90 bg-white/90 p-8 shadow-sm"
    : "rounded-2xl border border-white/[0.08] bg-[#121821]/80 p-8";
  const h1 = light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white";
  const muted = light ? "text-sm text-slate-600" : "text-sm text-white/65";

  return (
    <div className={`mx-auto max-w-3xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <h1 className={h1}>Sales Booster</h1>
      <p className={muted + " mt-1"}>Pro-only workspace tools.</p>

      <div className={cardShell + " mt-8"}>
        {!unlocked ? (
          <>
            <p className={light ? "text-lg font-semibold text-slate-900" : "text-lg font-semibold text-white"}>
              Upgrade to Pro
            </p>
            <p className={muted + " mt-2"}>
              Sales Booster dashboards require an active Pro plan on your workspace.
            </p>
            <Link
              href="/bgos/subscription"
              className="mt-4 inline-flex rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-900"
            >
              View plans
            </Link>
          </>
        ) : (
          <>
            <p className={muted}>Your workspace has Pro access.</p>
            <Link
              href="/sales-booster/dashboard"
              className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Open Sales Booster
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
