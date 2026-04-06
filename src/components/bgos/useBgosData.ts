"use client";

import { CompanyPlan, UserRole } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardMetrics } from "@/types";

export type DashboardPayload = DashboardMetrics;

async function readDashboardErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; code?: string };
    if (typeof j.error === "string" && j.error.trim()) return j.error;
    if (j.code === "UNAUTHORIZED") return "Session expired — sign in again.";
    if (j.code === "FORBIDDEN") return "You do not have access to this dashboard.";
  } catch {
    /* ignore */
  }
  if (res.status === 401) return "Session expired — sign in again.";
  if (res.status === 403) return "You do not have access to this dashboard.";
  return "Could not load live data.";
}

const EMPTY_NEXA: DashboardMetrics["nexa"] = {
  pendingFollowUps: 0,
  overdueFollowUps: 0,
  delays: 0,
  opportunities: 0,
};

const EMPTY_OPS: DashboardMetrics["operations"] = {
  installationQueue: 0,
  openServiceTickets: 0,
  pendingPayments: 0,
};

const EMPTY_REV: DashboardMetrics["revenueBreakdown"] = {
  monthlyWon: 0,
  pipelineValue: 0,
  expectedClosures: 0,
  pendingAmount: 0,
};

const EMPTY_RISKS: DashboardMetrics["risks"] = {
  lostLeads: 0,
  delays: 0,
  openServiceTickets: 0,
};

const EMPTY_HEALTH: DashboardMetrics["health"] = {
  efficiency: 0,
  conversion: 0,
  teamProductivity: 0,
};

function normalizeDashboard(d: DashboardPayload): DashboardPayload {
  return {
    ...d,
    insights: Array.isArray(d.insights) ? d.insights : [],
    pipeline: Array.isArray(d.pipeline) ? d.pipeline : [],
    nexa: d.nexa ?? EMPTY_NEXA,
    operations: d.operations ?? EMPTY_OPS,
    revenueBreakdown: d.revenueBreakdown ?? EMPTY_REV,
    risks: d.risks ?? EMPTY_RISKS,
    health: d.health ?? EMPTY_HEALTH,
    team: Array.isArray(d.team) ? d.team : [],
  };
}

export function useBgosData(pollMs = 4000) {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyPlan, setCompanyPlan] = useState<CompanyPlan | null>(null);
  /** Optimistic: hide Pro upsell surfaces until `/api/auth/me` confirms (avoids flash in production). */
  const [planLockedToBasic, setPlanLockedToBasic] = useState(
    () => process.env.NODE_ENV === "production",
  );
  const [sessionRole, setSessionRole] = useState<UserRole | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  /** Bumped after each successful `/api/dashboard` load so pipeline / lists stay in sync. */
  const [syncGeneration, setSyncGeneration] = useState(0);
  const okOnce = useRef(false);

  const refetch = useCallback(() => {
    setError(null);
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (j: {
          authenticated?: boolean;
          planLockedToBasic?: boolean;
          user?: { companyPlan?: CompanyPlan; role?: UserRole };
        } | null) => {
          if (j?.authenticated === true) {
            setPlanLockedToBasic(j.planLockedToBasic === true);
          }
          const p = j?.user?.companyPlan;
          if (p === CompanyPlan.BASIC || p === CompanyPlan.PRO) setCompanyPlan(p);
          if (j?.user?.role) setSessionRole(j.user.role);
        },
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/dashboard", { credentials: "include" });
        if (!res.ok) {
          const msg = await readDashboardErrorMessage(res);
          if (!cancelled && !okOnce.current) setError(msg);
          return;
        }
        const d = (await res.json()) as DashboardPayload;
        const salesBooster =
          d.salesBooster ??
          ({
            plan: "BASIC",
            featuresUnlocked: false,
            companyName: "",
          } as const);
        if (!cancelled) {
          if (salesBooster.plan === CompanyPlan.BASIC || salesBooster.plan === CompanyPlan.PRO) {
            setCompanyPlan(salesBooster.plan);
          }
          setDashboard(
            normalizeDashboard({
              ...d,
              salesBooster,
            }),
          );
          setError(null);
          okOnce.current = true;
          setSyncGeneration((n) => n + 1);
        }
      } catch {
        if (!cancelled && !okOnce.current) {
          setError("Network error — check your connection.");
        }
      }
    };

    void load();
    const id = window.setInterval(() => void load(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pollMs, reloadToken]);

  const isLoading = dashboard === null && error === null;

  return {
    dashboard,
    error,
    companyPlan,
    planLockedToBasic,
    sessionRole,
    refetch,
    isLoading,
    syncGeneration,
  };
}
