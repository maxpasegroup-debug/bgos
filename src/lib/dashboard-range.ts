import { z } from "zod";

export const DASHBOARD_RANGE_PRESETS = [
  "today",
  "this_month",
  "last_month",
  "3_months",
  "6_months",
  "1_year",
  "all_time",
] as const;

export type DashboardRangePreset = (typeof DASHBOARD_RANGE_PRESETS)[number];

export const dashboardRangePresetSchema = z.enum(DASHBOARD_RANGE_PRESETS);

export const DASHBOARD_RANGE_LABELS: Record<DashboardRangePreset, string> = {
  today: "Today",
  this_month: "This Month",
  last_month: "Last Month",
  "3_months": "3 Months",
  "6_months": "6 Months",
  "1_year": "1 Year",
  all_time: "All Time",
};

/** BASIC (non–Pro+) may only request these presets; broader ranges require Pro+. */
export const DASHBOARD_RANGE_BASIC_FREE = ["today", "this_month"] as const satisfies readonly DashboardRangePreset[];

const BASIC_FREE_SET = new Set<string>(DASHBOARD_RANGE_BASIC_FREE);

export function dashboardRangeRequiresPro(preset: DashboardRangePreset): boolean {
  return !BASIC_FREE_SET.has(preset);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, d.getDate(), 0, 0, 0, 0);
}

export type ResolvedDashboardRange = {
  preset: DashboardRangePreset;
  start: Date;
  end: Date;
  label: string;
};

/**
 * Resolve preset to [start, end] in local time (matches financial-metrics).
 */
export function resolveDashboardRange(preset: DashboardRangePreset, now = new Date()): ResolvedDashboardRange {
  const label = DASHBOARD_RANGE_LABELS[preset];
  switch (preset) {
    case "today": {
      const start = startOfDay(now);
      const end = endOfDay(now);
      return { preset, start, end, label };
    }
    case "this_month": {
      const start = startOfMonth(now);
      const end = endOfDay(now);
      return { preset, start, end, label };
    }
    case "last_month": {
      const ref = addMonths(now, -1);
      const start = startOfMonth(ref);
      const end = endOfMonth(ref);
      return { preset, start, end, label };
    }
    case "3_months": {
      const start = startOfMonth(addMonths(now, -2));
      const end = endOfDay(now);
      return { preset, start, end, label };
    }
    case "6_months": {
      const start = startOfMonth(addMonths(now, -5));
      const end = endOfDay(now);
      return { preset, start, end, label };
    }
    case "1_year": {
      const start = startOfMonth(addMonths(now, -11));
      const end = endOfDay(now);
      return { preset, start, end, label };
    }
    case "all_time": {
      const start = new Date(2000, 0, 1, 0, 0, 0, 0);
      const end = endOfDay(now);
      return { preset, start, end, label };
    }
  }
}

/** Chart window: full range, except all-time (trailing 36 months). */
export function trendWindowForRange(resolved: ResolvedDashboardRange): {
  trendStart: Date;
  trendEnd: Date;
  allTimeChart: boolean;
} {
  if (resolved.preset === "all_time") {
    const ref = addMonths(resolved.end, -35);
    const trendStart = startOfMonth(ref);
    return { trendStart, trendEnd: resolved.end, allTimeChart: true };
  }
  return { trendStart: resolved.start, trendEnd: resolved.end, allTimeChart: false };
}

export function parseDashboardRangeQuery(raw: string | null | undefined): ResolvedDashboardRange {
  const parsed = dashboardRangePresetSchema.safeParse(raw?.trim() || "this_month");
  const preset = parsed.success ? parsed.data : "this_month";
  return resolveDashboardRange(preset);
}
