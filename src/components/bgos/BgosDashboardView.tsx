"use client";

import { UserRole } from "@prisma/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch, readApiJson } from "@/lib/api-fetch";
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
  const searchParams = useSearchParams();
  const isIntelHome = !section;
  const {
    dashboard,
    error,
    refetch,
    isLoading,
    analyticsRangePreset,
    sessionRole,
    isSuperBoss,
  } = useBgosDashboardContext();
  /** Company boss + platform owner: command center (grid), not the intelligence / “pulse” home. */
  const useBossCommandCenterHome =
    sessionRole === UserRole.ADMIN || isSuperBoss === true;
  const scrollKey = section ? routeToSection[section] ?? section : undefined;
  const [userName, setUserName] = useState("Boss");
  const [showBuildingPanel, setShowBuildingPanel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/auth/me");
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

  useEffect(() => {
    if (searchParams.get("building") === "1") {
      setShowBuildingPanel(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/company/building-status", { credentials: "include" });
        const j = ((await readApiJson(res, "building-status")) ?? {}) as { building?: boolean };
        if (!cancelled && res.ok && j.building === true) setShowBuildingPanel(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  if (isLoading) {
    if (isIntelHome && !useBossCommandCenterHome) {
      return <BgosIntelligenceHomeSkeleton />;
    }
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
            className="mt-6 w-full rounded-2xl bg-[#FFC300]/90 px-4 py-3 text-sm font-semibold text-black shadow-[0_0_28px_-6px_rgba(255,195,0,0.45)] transition hover:scale-[1.02] hover:bg-[#FFC300] sm:w-auto sm:min-w-[10rem]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (isIntelHome && !useBossCommandCenterHome) {
    return <BgosIntelligenceHome />;
  }

  return (
    <>
      {showBuildingPanel ? (
        <section className={`${BGOS_MAIN_PAD} pb-2 pt-5`}>
          <div className="mx-auto max-w-3xl rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-950/60 via-slate-950/80 to-indigo-950/60 px-5 py-5 text-slate-100 shadow-lg sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200/80">Setup</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Your system is being prepared</h2>
            <p className="mt-2 text-sm text-slate-200/90">
              Setup is in progress. Our team is building your dashboard — you can keep exploring BGOS; modules will
              unlock as soon as we finish.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/contact"
                className="inline-flex rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
              >
                Contact support
              </Link>
              <span className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-xs text-white/50">
                View updates (coming soon)
              </span>
            </div>
          </div>
        </section>
      ) : null}
      <section className={`${BGOS_MAIN_PAD} pb-2 pt-5`}>
        <div className="rounded-2xl border border-white/[0.10] bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent px-5 py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:px-6 sm:py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Business overview
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
