"use client";

import type { ReactNode } from "react";
import { BgosAmbientBackground } from "./BgosAmbientBackground";
import { BgosCheckoutSuccess } from "./BgosCheckoutSuccess";
import { useBgosDashboardContext } from "./BgosDataProvider";
import { BgosHeader } from "./BgosHeader";
import { BgosSidebar } from "./BgosSidebar";
import { BgosTrialExpiredOverlay } from "./BgosTrialExpiredOverlay";
import { PlanUpgradeBanner } from "./PlanUpgradeBanner";

export function BgosAppChrome({ children }: { children: ReactNode }) {
  const { companyPlan, planLockedToBasic, trialReadOnly } = useBgosDashboardContext();

  return (
    <>
      {trialReadOnly ? <BgosTrialExpiredOverlay /> : null}
      <BgosAmbientBackground />
      <BgosSidebar />
      <div className="relative flex min-h-screen flex-col pl-16">
        <BgosHeader />
        {!planLockedToBasic && !trialReadOnly ? <PlanUpgradeBanner plan={companyPlan} /> : null}
        <div className="flex-1">{children}</div>
        <BgosCheckoutSuccess />
      </div>
    </>
  );
}
