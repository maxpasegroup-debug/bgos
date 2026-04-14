"use client";

import type { ReactNode } from "react";
import { CompanyPlan, type UserRole } from "@prisma/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { dashboardRangeRequiresPro, type DashboardRangePreset } from "@/lib/dashboard-range";
import { type DashboardPayload, useBgosData } from "./useBgosData";

type Ctx = {
  dashboard: DashboardPayload | null;
  error: string | null;
  companyPlan: CompanyPlan | null;
  /** When true, Sales Booster and Pro upgrade prompts are hidden (deployment lock). */
  planLockedToBasic: boolean;
  /** PRO or ENTERPRISE (not BASIC), and not deployment-locked. */
  hasProPlan: boolean;
  /** Basic plan trial ended for the active company — server-enforced; use to disable writes in UI. */
  basicTrialExpired: boolean;
  trialReadOnly: boolean;
  sessionRole: UserRole | null;
  /** Platform owner ({@link process.env.BGOS_BOSS_EMAIL} + session). */
  isSuperBoss: boolean;
  /** Platform boss with no active company — live `/api/dashboard` is skipped on `/bgos/dashboard`. */
  superBossNoCompany: boolean;
  /** Permanent Pro / trial bypass for the platform boss email only (server-flagged). */
  bossBillingBypass: boolean;
  refetch: () => void;
  isLoading: boolean;
  /** Increments after each successful `/api/dashboard` load — use to sync child fetches. */
  syncGeneration: number;
  analyticsRangePreset: DashboardRangePreset;
  setAnalyticsRangePreset: (preset: DashboardRangePreset) => void;
};

const BgosDataContext = createContext<Ctx | null>(null);

export function BgosDataProvider({ children }: { children: ReactNode }) {
  const [analyticsRangePreset, setAnalyticsRangePresetState] =
    useState<DashboardRangePreset>("this_month");

  const onPlanProRequired = useCallback(() => {
    setAnalyticsRangePresetState("this_month");
  }, []);

  const {
    dashboard,
    error,
    companyPlan,
    planLockedToBasic,
    basicTrialExpired,
    trialReadOnly,
    sessionRole,
    isSuperBoss,
    bossBillingBypass,
    refetch,
    isLoading,
    syncGeneration,
    superBossNoCompany,
  } = useBgosData(4000, analyticsRangePreset, onPlanProRequired);

  const hasProPlan = useMemo(
    () =>
      bossBillingBypass ||
      (!planLockedToBasic &&
        (companyPlan === CompanyPlan.PRO || companyPlan === CompanyPlan.ENTERPRISE)),
    [bossBillingBypass, planLockedToBasic, companyPlan],
  );

  const setAnalyticsRangePreset = useCallback(
    (preset: DashboardRangePreset) => {
      const pro =
        bossBillingBypass ||
        (!planLockedToBasic &&
          (companyPlan === CompanyPlan.PRO || companyPlan === CompanyPlan.ENTERPRISE));
      if (!pro && dashboardRangeRequiresPro(preset)) return;
      setAnalyticsRangePresetState(preset);
    },
    [bossBillingBypass, planLockedToBasic, companyPlan],
  );

  useEffect(() => {
    if (hasProPlan) return;
    if (dashboardRangeRequiresPro(analyticsRangePreset)) {
      setAnalyticsRangePresetState("this_month");
    }
  }, [hasProPlan, analyticsRangePreset]);

  const value = useMemo(
    () => ({
      dashboard,
      error,
      companyPlan,
      planLockedToBasic,
      hasProPlan,
      basicTrialExpired,
      trialReadOnly,
      sessionRole,
      isSuperBoss,
      superBossNoCompany,
      bossBillingBypass,
      refetch,
      isLoading,
      syncGeneration,
      analyticsRangePreset,
      setAnalyticsRangePreset,
    }),
    [
      dashboard,
      error,
      companyPlan,
      planLockedToBasic,
      hasProPlan,
      basicTrialExpired,
      trialReadOnly,
      sessionRole,
      isSuperBoss,
      superBossNoCompany,
      bossBillingBypass,
      refetch,
      isLoading,
      syncGeneration,
      analyticsRangePreset,
      setAnalyticsRangePreset,
    ],
  );
  return (
    <BgosDataContext.Provider value={value}>{children}</BgosDataContext.Provider>
  );
}

export function useBgosDashboardContext() {
  const ctx = useContext(BgosDataContext);
  if (!ctx) {
    throw new Error("useBgosDashboardContext must be used under BgosDataProvider");
  }
  return ctx;
}

/** Safe outside `BgosDataProvider` (e.g. ICECONNECT vault) — defaults to false. */
export function useBgosTrialReadOnly(): boolean {
  return useContext(BgosDataContext)?.trialReadOnly ?? false;
}
