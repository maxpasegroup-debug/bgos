"use client";

import type { ReactNode } from "react";
import { BgosAmbientBackground } from "./BgosAmbientBackground";
import { BgosHeader } from "./BgosHeader";
import { BgosSidebar } from "./BgosSidebar";
import { useBgosDashboardContext } from "./BgosDataProvider";
import { PlanUpgradeBanner } from "./PlanUpgradeBanner";

export function BgosAppChrome({ children }: { children: ReactNode }) {
  const { companyPlan, planLockedToBasic } = useBgosDashboardContext();

  return (
    <>
      <BgosAmbientBackground />
      <BgosSidebar />
      <div className="relative flex min-h-screen flex-col pl-16">
        <BgosHeader />
        {!planLockedToBasic ? <PlanUpgradeBanner plan={companyPlan} /> : null}
        <div className="flex-1">{children}</div>
      </div>
    </>
  );
}
