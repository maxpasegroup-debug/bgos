import type { PipelineCol, TeamMember } from "./internal-sales-types";

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function readError(j: unknown, fallback: string): string {
  if (!isRecord(j)) return fallback;
  const e = j.error ?? j.message;
  if (typeof e === "string" && e.trim()) return e.trim();
  return fallback;
}

export function readPipelinePayload(j: unknown): PipelineCol[] | null {
  if (!isRecord(j) || j.ok !== true) return null;
  const top = j.pipeline;
  if (Array.isArray(top)) return top as PipelineCol[];
  const d = j.data;
  if (isRecord(d) && Array.isArray(d.pipeline)) return d.pipeline as PipelineCol[];
  return null;
}

export type DashboardPayload = {
  metrics: {
    leadsToday: number;
    callsToday: number;
    demosScheduled: number;
    closedDeals: number;
    conversionPercent?: number;
    rangeLeads?: number;
  };
  funnel?: { leads: number; demoOrLater: number; closedWon: number };
  employeePerformance: {
    userId: string;
    name: string;
    leadsHandled: number;
    callsMade: number;
    conversions: number;
    performanceScore?: number;
    targetLeadsToday?: number | null;
    targetCallsToday?: number | null;
  }[];
  topPerformer?: { name: string; score: number } | null;
  weakPerformers?: { name: string; conversions: number }[];
  alerts: string[];
  automation?: {
    delayedLeads: { id: string; name: string; createdAt: string }[];
    stuckFollowUp: { id: string; name: string; updatedAt: string }[];
    noActivityLeads: { id: string; name: string; lastContactedAt: string | null }[];
    dailySummary: { leadsToday: number; callsToday: number; conversionsPercent: number };
  };
  trendRange?: string;
};

export function readDashboardPayload(j: unknown): DashboardPayload | null {
  if (!isRecord(j) || j.ok !== true) return null;
  const metrics = j.metrics;
  if (isRecord(metrics)) {
    return {
      metrics: metrics as DashboardPayload["metrics"],
      funnel: isRecord(j.funnel) ? (j.funnel as DashboardPayload["funnel"]) : undefined,
      employeePerformance: Array.isArray(j.employeePerformance)
        ? (j.employeePerformance as DashboardPayload["employeePerformance"])
        : [],
      topPerformer:
        isRecord(j.topPerformer) && typeof j.topPerformer.name === "string"
          ? (j.topPerformer as DashboardPayload["topPerformer"])
          : null,
      weakPerformers: Array.isArray(j.weakPerformers)
        ? (j.weakPerformers as DashboardPayload["weakPerformers"])
        : [],
      alerts: Array.isArray(j.alerts) ? (j.alerts as string[]) : [],
      automation: isRecord(j.automation) ? (j.automation as DashboardPayload["automation"]) : undefined,
      trendRange: typeof j.trendRange === "string" ? j.trendRange : undefined,
    };
  }
  const d = j.data;
  if (isRecord(d) && isRecord(d.metrics)) {
    return {
      metrics: d.metrics as DashboardPayload["metrics"],
      funnel: isRecord(d.funnel) ? (d.funnel as DashboardPayload["funnel"]) : undefined,
      employeePerformance: Array.isArray(d.employeePerformance)
        ? (d.employeePerformance as DashboardPayload["employeePerformance"])
        : [],
      topPerformer:
        isRecord(d.topPerformer) && typeof d.topPerformer.name === "string"
          ? (d.topPerformer as DashboardPayload["topPerformer"])
          : null,
      weakPerformers: Array.isArray(d.weakPerformers)
        ? (d.weakPerformers as DashboardPayload["weakPerformers"])
        : [],
      alerts: Array.isArray(d.alerts) ? (d.alerts as string[]) : [],
      automation: isRecord(d.automation) ? (d.automation as DashboardPayload["automation"]) : undefined,
      trendRange: typeof d.trendRange === "string" ? d.trendRange : undefined,
    };
  }
  return null;
}

export function readTeamPayload(j: unknown): TeamMember[] | null {
  if (!isRecord(j) || j.ok !== true) return null;
  const top = j.team;
  if (Array.isArray(top)) return top as TeamMember[];
  const d = j.data;
  if (isRecord(d) && Array.isArray(d.team)) return d.team as TeamMember[];
  return null;
}

export function readDefaultAssigneePayload(j: unknown): string | null {
  if (!isRecord(j) || j.ok !== true) return null;
  const id = j.defaultAssigneeUserId;
  if (typeof id === "string" || id === null) return id;
  const d = j.data;
  if (isRecord(d)) {
    const id2 = d.defaultAssigneeUserId;
    if (typeof id2 === "string" || id2 === null) return id2;
  }
  return null;
}
