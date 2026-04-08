import "server-only";

import { z } from "zod";
import type { Prisma } from "@prisma/client";

const sliceSchema = z
  .object({
    enabled: z.boolean().optional(),
  })
  .strict();

export type AutomationCenterStored = z.infer<typeof sliceSchema>;

export const AUTOMATION_CENTER_DEFAULTS = {
  /** Master switch: background automations (NEXA auto-handle loop, Sales Booster on lead create, DB automation rows). */
  enabled: true,
} as const;

export function parseAutomationCenterFromDashboardConfig(
  raw: Prisma.JsonValue | null | undefined,
): { enabled: boolean } {
  if (raw === null || raw === undefined) {
    return { ...AUTOMATION_CENTER_DEFAULTS };
  }
  const root = raw as Record<string, unknown>;
  const slice = root.automationCenter;
  if (!slice || typeof slice !== "object" || Array.isArray(slice)) {
    return { ...AUTOMATION_CENTER_DEFAULTS };
  }
  const parsed = sliceSchema.safeParse(slice);
  if (!parsed.success) {
    return { ...AUTOMATION_CENTER_DEFAULTS };
  }
  return {
    enabled: parsed.data.enabled ?? AUTOMATION_CENTER_DEFAULTS.enabled,
  };
}

export function mergeAutomationCenterIntoDashboardConfig(
  existing: Prisma.JsonValue | null | undefined,
  patch: AutomationCenterStored,
): Prisma.InputJsonValue {
  const root =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const prevAc =
    root.automationCenter &&
    typeof root.automationCenter === "object" &&
    !Array.isArray(root.automationCenter)
      ? { ...(root.automationCenter as Record<string, unknown>) }
      : {};
  root.automationCenter = { ...prevAc, ...patch };
  return root as Prisma.InputJsonValue;
}
