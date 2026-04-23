"use client";

import { UserRole } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api-fetch";
import { BgosDashboardSkeletons, BgosIntelligenceHomeSkeleton } from "./BgosDashboardSkeletons";
import { BgosIntelligenceHome } from "./BgosIntelligenceHome";
import { BossPipelineView } from "./BossPipelineView";
import { SetupInProgressView } from "./SetupInProgressView";
import { SolarBossDashboard } from "./solar/SolarBossDashboard";
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
  const searchParams = useSearchParams();
  const isIntelHome = !section;
  const { dashboard, error, refetch, isLoading, sessionRole, isSuperBoss } = useBgosDashboardContext();
  const useBossCommandCenterHome = sessionRole === UserRole.ADMIN || isSuperBoss === true;
  const scrollKey = section ? routeToSection[section] ?? section : undefined;
  const [userName, setUserName] = useState("Boss");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [showBuildingPanel, setShowBuildingPanel] = useState(() => searchParams.get("building") === "1");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/user/profile", { credentials: "include" });
        if (!res.ok) return;
        const j = (await res.json()) as {
          displayName?: string;
          companyName?: string | null;
          companyId?: string | null;
        };
        const name = j.displayName?.trim() ?? "";
        const co = (j.companyName ?? j.companyId ?? "").trim();
        if (!cancelled && name) setUserName(name);
        if (!cancelled && co) setCompanyName(co);
      } catch {
        // Ignore transient profile reads.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!scrollKey || isLoading) return;
    const timer = window.setTimeout(() => {
      document.getElementById(scrollKey)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 140);
    return () => window.clearTimeout(timer);
  }, [scrollKey, isLoading]);

  useEffect(() => {
    if (searchParams.get("building") === "1") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/company/building-status", { credentials: "include" });
        const j = ((await readApiJson(res, "building-status")) ?? {}) as { building?: boolean };
        if (!cancelled && res.ok && j.building === true) setShowBuildingPanel(true);
      } catch {
        // Ignore background polling errors.
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

  if (showBuildingPanel) {
    return <SetupInProgressView />;
  }

  return (
    <>
      {useBossCommandCenterHome ? <BossPipelineView /> : null}
      <SolarBossDashboard
        dashboard={dashboard}
        userName={userName}
        companyName={companyName}
        metricsUnavailable={error !== null && dashboard === null}
      />
    </>
  );
}
