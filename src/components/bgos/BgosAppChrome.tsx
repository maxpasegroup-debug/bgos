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
  const { companyPlan, planLockedToBasic, trialReadOnly, controlShell } =
    useBgosDashboardContext();
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const sidebarPad = controlShell
    ? "pl-16 transition-all duration-300 ease-in-out peer-hover/bgos-sidebar:pl-[240px]"
    : BGOS_SIDEBAR_PAD;

  return (
    <div
      data-bgos-theme={theme}
      className={
        light
          ? "relative h-screen overflow-hidden text-slate-900 antialiased"
          : "relative h-screen overflow-hidden text-white antialiased"
      }
    >
      {trialReadOnly ? <BgosTrialExpiredOverlay /> : null}
      <BgosAmbientBackground />
      <BgosSidebar />
      <div className={`relative flex h-screen min-w-0 flex-col overflow-hidden ${sidebarPad}`}>
        <BgosHeader />
        {!controlShell && !planLockedToBasic && !trialReadOnly ? (
          <PlanUpgradeBanner plan={companyPlan} />
        ) : null}
        <main className="relative z-10 flex-1 overflow-y-auto">{children}</main>
        <BgosCheckoutSuccess />
      </div>
    </div>
  );
}
