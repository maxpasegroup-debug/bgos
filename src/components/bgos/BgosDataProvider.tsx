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
    refetch,
    isLoading,
    syncGeneration,
  } = useBgosData(4000, analyticsRangePreset, onPlanProRequired);

  const hasProPlan = useMemo(
    () =>
      !planLockedToBasic &&
      (companyPlan === CompanyPlan.PRO || companyPlan === CompanyPlan.ENTERPRISE),
    [planLockedToBasic, companyPlan],
  );

  const setAnalyticsRangePreset = useCallback(
    (preset: DashboardRangePreset) => {
      const pro =
        !planLockedToBasic &&
        (companyPlan === CompanyPlan.PRO || companyPlan === CompanyPlan.ENTERPRISE);
      if (!pro && dashboardRangeRequiresPro(preset)) return;
      setAnalyticsRangePresetState(preset);
    },
    [planLockedToBasic, companyPlan],
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
