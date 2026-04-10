"use client";

import type { ReactNode } from "react";
import { BgosAmbientBackground } from "./BgosAmbientBackground";
import { BgosCheckoutSuccess } from "./BgosCheckoutSuccess";
import { useBgosDashboardContext } from "./BgosDataProvider";
import { BgosHeader } from "./BgosHeader";
import { BgosSidebar } from "./BgosSidebar";
import { BgosTrialExpiredOverlay } from "./BgosTrialExpiredOverlay";
import { BGOS_SIDEBAR_PAD } from "./layoutTokens";
import { PlanUpgradeBanner } from "./PlanUpgradeBanner";
import { useBgosTheme } from "./BgosThemeContext";

export function BgosAppChrome({ children }: { children: ReactNode }) {
  const { companyPlan, planLockedToBasic, trialReadOnly } = useBgosDashboardContext();
  const { theme } = useBgosTheme();
  const light = theme === "light";

  return (
    <div
      data-bgos-theme={theme}
      className={
        light
          ? "relative min-h-screen text-slate-900 antialiased"
          : "relative min-h-screen text-white antialiased"
      }
    >
      {trialReadOnly ? <BgosTrialExpiredOverlay /> : null}
      <BgosAmbientBackground />
      <BgosSidebar />
      <div className={`relative flex min-h-screen flex-col ${BGOS_SIDEBAR_PAD}`}>
        <BgosHeader />
        {!planLockedToBasic && !trialReadOnly ? <PlanUpgradeBanner plan={companyPlan} /> : null}
        <div className="relative z-10 flex-1">{children}</div>
        <BgosCheckoutSuccess />
      </div>
    </div>
  );
}
