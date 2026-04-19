"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname() ?? "";
  const { companyPlan, planLockedToBasic, trialReadOnly, controlShell } =
    useBgosDashboardContext();
  const { theme } = useBgosTheme();
  const light = theme === "light";
  /** Control plane (super boss) — V4 design system base. */
  const controlV4Surface = controlShell && pathname.startsWith("/bgos/control");
  const sidebarPad = controlShell
    ? "pl-16 transition-all duration-300 ease-in-out peer-hover/bgos-sidebar:pl-[240px]"
    : BGOS_SIDEBAR_PAD;

  return (
    <div
      data-bgos-theme={theme}
      className={
        light
          ? "relative flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900 antialiased"
          : controlV4Surface
            ? "relative flex h-screen flex-col overflow-hidden bg-[#05070A] text-white antialiased"
            : "relative flex h-screen flex-col overflow-hidden bg-[#0b0f19] text-white antialiased"
      }
    >
      {trialReadOnly ? <BgosTrialExpiredOverlay /> : null}
      <BgosAmbientBackground />
      <BgosSidebar />
      <div className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${sidebarPad}`}>
        <BgosHeader />
        {!controlShell && !planLockedToBasic && !trialReadOnly ? (
          <PlanUpgradeBanner plan={companyPlan} />
        ) : null}
        <main className="relative z-10 min-h-0 flex-1 overflow-y-auto">{children}</main>
        <BgosCheckoutSuccess />
      </div>
    </div>
  );
}
