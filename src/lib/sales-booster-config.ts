import "server-only";

import { z } from "zod";
import type { Prisma } from "@prisma/client";

/** What to run automatically when a new lead is created (Pro+). */
export type SalesBoosterOnLeadCreated = "assign" | "whatsapp" | "both";

const configSchema = z
  .object({
    onLeadCreated: z.enum(["assign", "whatsapp", "both"]).optional(),
    followUpScheduleEnabled: z.boolean().optional(),
  })
  .strict();

export type SalesBoosterStoredConfig = z.infer<typeof configSchema>;

export const SALES_BOOSTER_DEFAULTS = {
  onLeadCreated: "both" as SalesBoosterOnLeadCreated,
  followUpScheduleEnabled: true,
} as const;

export function parseSalesBoosterFromDashboardConfig(
  raw: Prisma.JsonValue | null | undefined,
): { onLeadCreated: SalesBoosterOnLeadCreated; followUpScheduleEnabled: boolean } {
  if (raw === null || raw === undefined) {
    return { ...SALES_BOOSTER_DEFAULTS };
  }
  const root = raw as Record<string, unknown>;
  const slice = root.salesBooster;
  if (!slice || typeof slice !== "object" || Array.isArray(slice)) {
    return { ...SALES_BOOSTER_DEFAULTS };
  }
  const parsed = configSchema.safeParse(slice);
  if (!parsed.success) {
    return { ...SALES_BOOSTER_DEFAULTS };
  }
  const c = parsed.data;
  return {
    onLeadCreated: c.onLeadCreated ?? SALES_BOOSTER_DEFAULTS.onLeadCreated,
    followUpScheduleEnabled:
      c.followUpScheduleEnabled ?? SALES_BOOSTER_DEFAULTS.followUpScheduleEnabled,
  };
}

export function mergeSalesBoosterIntoDashboardConfig(
  existing: Prisma.JsonValue | null | undefined,
  patch: SalesBoosterStoredConfig,
): Prisma.InputJsonValue {
  const root =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const prevSb =
    root.salesBooster && typeof root.salesBooster === "object" && !Array.isArray(root.salesBooster)
      ? { ...(root.salesBooster as Record<string, unknown>) }
      : {};
  const nextSb = { ...prevSb, ...patch };
  root.salesBooster = nextSb;
  return root as Prisma.InputJsonValue;
}
