"use client";

import { CompanyPlan, UserRole } from "@prisma/client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyFinancialOverview,
  normalizeFinancialOverview,
} from "@/lib/dashboard-client-defaults";
import type {
  DashboardAnalytics,
  DashboardAnalyticsRangeMeta,
  DashboardMetrics,
  SalesBoosterPro,
} from "@/types";

export type DashboardPayload = DashboardMetrics;

async function readDashboardErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; code?: string };
    if (typeof j.error === "string" && j.error.trim()) return j.error;
    if (j.code === "TRIAL_EXPIRED") {
      return typeof j.error === "string" && j.error.trim()
        ? j.error
        : "Your free trial has expired. Upgrade to continue.";
    }
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
  pendingSiteVisits: 0,
  pendingApprovals: 0,
  installationsInProgress: 0,
};

const EMPTY_REV: DashboardMetrics["revenueBreakdown"] = {
  monthlyWon: 0,
  pipelineValue: 0,
  expectedClosures: 0,
  pendingAmount: 0,
  unpaidInvoiceCount: 0,
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

const EMPTY_HR: DashboardMetrics["hr"] = {
  totalEmployees: 0,
  leavesPending: 0,
  attendancePercent: 0,
};

const EMPTY_INVENTORY: DashboardMetrics["inventory"] = {
  products: 0,
  lowStockItems: 0,
  totalUnits: 0,
};

const EMPTY_PARTNER: DashboardMetrics["partner"] = {
  totalPartnerLeads: 0,
  totalCommissionPayable: 0,
};

const EMPTY_ANALYTICS: DashboardAnalytics = {
  revenue: 0,
  leads: 0,
  conversionPercent: 0,
  expenses: 0,
  trend: [],
};

const EMPTY_ANALYTICS_RANGE: DashboardAnalyticsRangeMeta = {
  preset: "this_month",
  from: "",
  to: "",
  label: "This Month",
};

function normalizeSalesBooster(sb: DashboardPayload["salesBooster"]): DashboardPayload["salesBooster"] {
  if (!sb || sb.plan === "BASIC" || !sb.featuresUnlocked) return sb;
  const pro = sb as SalesBoosterPro;
  return {
    ...pro,
    onLeadCreated: pro.onLeadCreated ?? "both",
    followUpScheduleEnabled: pro.followUpScheduleEnabled ?? true,
    scheduledBoosterTaskCount: pro.scheduledBoosterTaskCount ?? 0,
  };
}

function normalizeDashboard(d: DashboardPayload): DashboardPayload {
  return {
    ...d,
    automationCenter:
      d.automationCenter === null || d.automationCenter === undefined
        ? null
        : d.automationCenter,
    salesBooster: normalizeSalesBooster(d.salesBooster),
    insights: Array.isArray(d.insights) ? d.insights : [],
    pipeline: Array.isArray(d.pipeline) ? d.pipeline : [],
    nexa: d.nexa ?? EMPTY_NEXA,
    operations: d.operations ?? EMPTY_OPS,
    revenueBreakdown: d.revenueBreakdown ?? EMPTY_REV,
    risks: d.risks ?? EMPTY_RISKS,
    health: d.health ?? EMPTY_HEALTH,
    hr: d.hr ?? EMPTY_HR,
    inventory: d.inventory ?? EMPTY_INVENTORY,
    partner: d.partner ?? EMPTY_PARTNER,
    team: Array.isArray(d.team) ? d.team : [],
    financial: normalizeFinancialOverview(d.financial),
    analytics: d.analytics ?? EMPTY_ANALYTICS,
    analyticsRange: d.analyticsRange ?? EMPTY_ANALYTICS_RANGE,
  };
}

export function useBgosData(
  pollMs = 4000,
  analyticsRangePreset: string = "this_month",
  onPlanProRequired?: () => void,
) {
  const pathname = usePathname();
  const controlShell =
    typeof pathname === "string" &&
    (pathname === "/bgos/control" || pathname.startsWith("/bgos/control/"));
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyPlan, setCompanyPlan] = useState<CompanyPlan | null>(null);
  /** Optimistic: hide Pro upsell surfaces until `/api/auth/me` confirms (avoids flash in production). */
  const [planLockedToBasic, setPlanLockedToBasic] = useState(
    () => process.env.NODE_ENV === "production",
  );
  const [sessionRole, setSessionRole] = useState<UserRole | null>(null);
  /** Active Basic company trial ended (JWT and/or DB); mutations should be blocked in UI. */
  const [basicTrialExpired, setBasicTrialExpired] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  /** Bumped after each successful `/api/dashboard` load so pipeline / lists stay in sync. */
  const [syncGeneration, setSyncGeneration] = useState(0);
  const [isSuperBoss, setIsSuperBoss] = useState(false);
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
          basicTrialExpired?: boolean;
          user?: {
            companyPlan?: CompanyPlan;
            role?: UserRole;
            isSuperBoss?: boolean;
          };
        } | null) => {
          if (j?.authenticated === true) {
            setPlanLockedToBasic(j.planLockedToBasic === true);
            setBasicTrialExpired(j.basicTrialExpired === true);
          } else {
            setBasicTrialExpired(false);
          }
          setIsSuperBoss(j?.user?.isSuperBoss === true);
          const p = j?.user?.companyPlan;
          if (
            p === CompanyPlan.BASIC ||
            p === CompanyPlan.PRO ||
            p === CompanyPlan.ENTERPRISE
          ) {
            setCompanyPlan(p);
          }
          if (j?.user?.role) setSessionRole(j.user.role);
        },
      )
      .catch(() => {});
  }, [reloadToken]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (controlShell) {
        if (!cancelled) {
          setDashboard(
            normalizeDashboard({
              leads: 0,
              revenue: 0,
              installations: 0,
              pendingPayments: 0,
              pipeline: [],
              insights: [],
              salesBooster: { plan: "BASIC", featuresUnlocked: false, companyName: "" },
              automationCenter: null,
              nexa: EMPTY_NEXA,
              operations: EMPTY_OPS,
              revenueBreakdown: EMPTY_REV,
              risks: EMPTY_RISKS,
              health: EMPTY_HEALTH,
              hr: EMPTY_HR,
              inventory: EMPTY_INVENTORY,
              partner: EMPTY_PARTNER,
              team: [],
              financial: emptyFinancialOverview(),
              analytics: EMPTY_ANALYTICS,
              analyticsRange: EMPTY_ANALYTICS_RANGE,
            }),
          );
          setError(null);
          okOnce.current = true;
        }
        return;
      }
      try {
        const dashUrl = `/api/dashboard?range=${encodeURIComponent(analyticsRangePreset)}`;
        const res = await fetch(dashUrl, { credentials: "include" });
        const text = await res.text();
        if (!res.ok) {
          if (res.status === 403) {
            try {
              const j = JSON.parse(text) as { code?: string; error?: string };
              if (j.code === "PLAN_PRO_REQUIRED") {
                onPlanProRequired?.();
                if (!cancelled) setError(null);
                return;
              }
              if (!cancelled && !okOnce.current) {
                if (j.code === "TRIAL_EXPIRED") {
                  setError(
                    typeof j.error === "string" && j.error.trim()
                      ? j.error
                      : "Your free trial has expired. Upgrade to continue.",
                  );
                } else {
                  setError(
                    typeof j.error === "string" && j.error.trim()
                      ? j.error
                      : "This feature requires a Pro plan.",
                  );
                }
              }
            } catch {
              if (!cancelled && !okOnce.current) setError("Could not load live data.");
            }
            return;
          }
          if (!cancelled && !okOnce.current) {
            try {
              const j = JSON.parse(text) as { error?: string; code?: string };
              if (typeof j.error === "string" && j.error.trim()) {
                setError(j.error);
              } else if (j.code === "UNAUTHORIZED" || res.status === 401) {
                setError("Session expired — sign in again.");
              } else {
                setError("Could not load live data.");
              }
            } catch {
              setError(res.status === 401 ? "Session expired — sign in again." : "Could not load live data.");
            }
          }
          return;
        }
        const d = JSON.parse(text) as DashboardPayload;
        const salesBooster =
          d.salesBooster ??
          ({
            plan: "BASIC",
            featuresUnlocked: false,
            companyName: "",
          } as const);
        if (!cancelled) {
          if (
            salesBooster.plan === "BASIC" ||
            salesBooster.plan === "PRO" ||
            salesBooster.plan === "ENTERPRISE"
          ) {
            if (salesBooster.plan !== "BASIC") {
              setCompanyPlan(
                salesBooster.plan === "ENTERPRISE"
                  ? CompanyPlan.ENTERPRISE
                  : CompanyPlan.PRO,
              );
            } else {
              setCompanyPlan(CompanyPlan.BASIC);
            }
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
    if (controlShell) {
      return () => {
        cancelled = true;
      };
    }
    const id = window.setInterval(() => void load(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pollMs, reloadToken, analyticsRangePreset, onPlanProRequired, controlShell]);

  const isLoading = !controlShell && dashboard === null && error === null;

  const trialReadOnly = basicTrialExpired;

  return {
    dashboard,
    error,
    companyPlan,
    planLockedToBasic,
    sessionRole,
    basicTrialExpired,
    trialReadOnly,
    refetch,
    isLoading,
    syncGeneration,
    isSuperBoss,
  };
}
