"use client";

import { CompanyPlan } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardMetrics } from "@/types";

export type DashboardPayload = DashboardMetrics;

export type PipelineRow = { stage: string; count: number };

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

export function useBgosData(pollMs = 5000) {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyPlan, setCompanyPlan] = useState<CompanyPlan | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const okOnce = useRef(false);

  const refetch = useCallback(() => {
    setError(null);
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { user?: { companyPlan?: CompanyPlan } } | null) => {
        const p = j?.user?.companyPlan;
        if (p === CompanyPlan.BASIC || p === CompanyPlan.PRO) setCompanyPlan(p);
      })
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
          setDashboard({
            ...d,
            insights: Array.isArray(d.insights) ? d.insights : [],
            pipeline: Array.isArray(d.pipeline) ? d.pipeline : [],
            salesBooster,
          });
          setError(null);
          okOnce.current = true;
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

  const pipeline: PipelineRow[] | null = dashboard?.pipeline ?? null;
  const isLoading = dashboard === null && error === null;

  return { dashboard, pipeline, error, companyPlan, refetch, isLoading };
}
