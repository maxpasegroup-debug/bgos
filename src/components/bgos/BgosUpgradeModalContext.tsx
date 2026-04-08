"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { PlanPricingModal } from "./PlanPricingModal";

type Ctx = { openPlanUpgrade: () => void };

const UpgradeCtx = createContext<Ctx | null>(null);

export function BgosUpgradeModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openPlanUpgrade = useCallback(() => setOpen(true), []);

  return (
    <UpgradeCtx.Provider value={{ openPlanUpgrade }}>
      <PlanPricingModal open={open} onOpenChange={setOpen} />
      {children}
    </UpgradeCtx.Provider>
  );
}

/** Opens the self-service pricing modal (no-op if provider is absent). */
export function useOpenPlanUpgrade(): () => void {
  const ctx = useContext(UpgradeCtx);
  return ctx?.openPlanUpgrade ?? (() => {});
}
