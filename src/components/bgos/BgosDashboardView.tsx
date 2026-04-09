"use client";

import { useEffect, useState } from "react";
import { BgosDashboardGrid } from "./BgosDashboardGrid";
import { BgosDashboardSkeletons, BgosIntelligenceHomeSkeleton } from "./BgosDashboardSkeletons";
import { BgosIntelligenceHome } from "./BgosIntelligenceHome";
import { useBgosDashboardContext } from "./BgosDataProvider";
import { BGOS_MAIN_PAD } from "./layoutTokens";
import { DASHBOARD_RANGE_LABELS } from "@/lib/dashboard-range";

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
  const isIntelHome = !section;
  const { dashboard, error, refetch, isLoading, analyticsRangePreset } = useBgosDashboardContext();
  const scrollKey = section ? routeToSection[section] ?? section : undefined;
  const [userName, setUserName] = useState("Boss");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const j = (await res.json()) as { user?: { name?: string } };
        const name = j.user?.name?.trim();
        if (!cancelled && name) setUserName(name);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    return isIntelHome ? <BgosIntelligenceHomeSkeleton /> : <BgosDashboardSkeletons />;
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
            className="mt-6 w-full rounded-2xl bg-[#FFC300]/90 px-4 py-3 text-sm font-semibold text-black shadow-[0_0_28px_-6px_rgba(255,195,0,0.45)] transition hover:scale-[1.02] hover:bg-[#FFC300] sm:w-auto sm:min-w-[10rem]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (isIntelHome) {
    return <BgosIntelligenceHome />;
  }

  return (
    <>
      <section className={`${BGOS_MAIN_PAD} pb-2 pt-5`}>
        <div className="rounded-2xl border border-white/[0.10] bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent px-5 py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:px-6 sm:py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Dashboard
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Welcome back, {userName}
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Period:{" "}
            <span className="font-medium text-white/85">
              {dashboard?.analyticsRange?.label ??
                DASHBOARD_RANGE_LABELS[analyticsRangePreset] ??
                "This Month"}
            </span>
          </p>
        </div>
      </section>
      <BgosDashboardGrid
        dashboard={dashboard}
        metricsUnavailable={error !== null && dashboard === null}
      />
    </>
  );
}
