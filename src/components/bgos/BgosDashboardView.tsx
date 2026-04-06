"use client";

import { useEffect } from "react";
import { BgosDashboardGrid } from "./BgosDashboardGrid";
import { BgosDashboardSkeletons } from "./BgosDashboardSkeletons";
import { useBgosDashboardContext } from "./BgosDataProvider";
import { BGOS_MAIN_PAD } from "./layoutTokens";

const routeToSection: Record<string, string> = {
  home: "overview",
  sales: "sales",
  operations: "operations",
  team: "team",
  revenue: "revenue",
  risks: "risks",
  nexa: "nexa",
};

export function BgosDashboardView({ section }: { section?: string }) {
  const { dashboard, error, refetch, isLoading } = useBgosDashboardContext();
  const scrollKey = section ? routeToSection[section] ?? section : undefined;

  useEffect(() => {
    if (!scrollKey || isLoading) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(scrollKey)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 140);
    return () => window.clearTimeout(timer);
  }, [scrollKey, isLoading]);

  if (isLoading) {
    return <BgosDashboardSkeletons />;
  }

  if (error !== null && dashboard === null) {
    return (
      <div className={`${BGOS_MAIN_PAD} pb-16 pt-10 sm:pt-12`}>
        <div
          className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center shadow-lg backdrop-blur-sm sm:p-8"
          role="alert"
        >
          <p className="text-sm font-medium text-white/90">{error}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-6 w-full rounded-xl bg-[#FFC300]/90 px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#FFC300] sm:w-auto sm:min-w-[10rem]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <BgosDashboardGrid
      dashboard={dashboard}
      metricsUnavailable={error !== null && dashboard === null}
    />
  );
}
