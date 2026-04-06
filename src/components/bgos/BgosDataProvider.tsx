"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { type DashboardPayload, useBgosData } from "./useBgosData";

import type { CompanyPlan, UserRole } from "@prisma/client";

type Ctx = {
  dashboard: DashboardPayload | null;
  error: string | null;
  companyPlan: CompanyPlan | null;
  /** When true, Sales Booster and Pro upgrade prompts are hidden (deployment lock). */
  planLockedToBasic: boolean;
  sessionRole: UserRole | null;
  refetch: () => void;
  isLoading: boolean;
  /** Increments when dashboard data successfully reloads — use to sync child fetches. */
  syncGeneration: number;
};

const BgosDataContext = createContext<Ctx | null>(null);

export function BgosDataProvider({ children }: { children: ReactNode }) {
  const {
    dashboard,
    error,
    companyPlan,
    planLockedToBasic,
    sessionRole,
    refetch,
    isLoading,
    syncGeneration,
  } = useBgosData();
  const value = useMemo(
    () => ({
      dashboard,
      error,
      companyPlan,
      planLockedToBasic,
      sessionRole,
      refetch,
      isLoading,
      syncGeneration,
    }),
    [
      dashboard,
      error,
      companyPlan,
      planLockedToBasic,
      sessionRole,
      refetch,
      isLoading,
      syncGeneration,
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
