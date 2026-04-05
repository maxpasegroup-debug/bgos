"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import {
  type DashboardPayload,
  type PipelineRow,
  useBgosData,
} from "./useBgosData";

import type { CompanyPlan, UserRole } from "@prisma/client";

type Ctx = {
  dashboard: DashboardPayload | null;
  pipeline: PipelineRow[] | null;
  error: string | null;
  companyPlan: CompanyPlan | null;
  sessionRole: UserRole | null;
  refetch: () => void;
  isLoading: boolean;
};

const BgosDataContext = createContext<Ctx | null>(null);

export function BgosDataProvider({ children }: { children: ReactNode }) {
  const { dashboard, pipeline, error, companyPlan, sessionRole, refetch, isLoading } =
    useBgosData();
  const value = useMemo(
    () => ({
      dashboard,
      pipeline,
      error,
      companyPlan,
      sessionRole,
      refetch,
      isLoading,
    }),
    [dashboard, pipeline, error, companyPlan, sessionRole, refetch, isLoading],
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
