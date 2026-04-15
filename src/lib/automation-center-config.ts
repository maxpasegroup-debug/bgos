import "server-only";

import { z } from "zod";
import type { Prisma } from "@prisma/client";

const sliceSchema = z
  .object({
    enabled: z.boolean().optional(),
    autonomyLevel: z.enum(["LEVEL_1", "LEVEL_2", "LEVEL_3"]).optional(),
    autoAssignLeads: z.boolean().optional(),
    autoReminders: z.boolean().optional(),
    autoTaskCreation: z.boolean().optional(),
    autoInactivityAlerts: z.boolean().optional(),
    autoUpgradeSuggestions: z.boolean().optional(),
  })
  .strict();

export type AutomationCenterStored = z.infer<typeof sliceSchema>;

export const AUTOMATION_CENTER_DEFAULTS = {
  /** Master switch: background automations (NEXA auto-handle loop, Sales Booster on lead create, DB automation rows). */
  enabled: true,
  autonomyLevel: "LEVEL_2",
  autoAssignLeads: true,
  autoReminders: true,
  autoTaskCreation: true,
  autoInactivityAlerts: true,
  autoUpgradeSuggestions: true,
} as const;

export function parseAutomationCenterFromDashboardConfig(
  raw: Prisma.JsonValue | null | undefined,
): {
  enabled: boolean;
  autonomyLevel: "LEVEL_1" | "LEVEL_2" | "LEVEL_3";
  autoAssignLeads: boolean;
  autoReminders: boolean;
  autoTaskCreation: boolean;
  autoInactivityAlerts: boolean;
  autoUpgradeSuggestions: boolean;
} {
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
    autonomyLevel: parsed.data.autonomyLevel ?? AUTOMATION_CENTER_DEFAULTS.autonomyLevel,
    autoAssignLeads: parsed.data.autoAssignLeads ?? AUTOMATION_CENTER_DEFAULTS.autoAssignLeads,
    autoReminders: parsed.data.autoReminders ?? AUTOMATION_CENTER_DEFAULTS.autoReminders,
    autoTaskCreation: parsed.data.autoTaskCreation ?? AUTOMATION_CENTER_DEFAULTS.autoTaskCreation,
    autoInactivityAlerts:
      parsed.data.autoInactivityAlerts ?? AUTOMATION_CENTER_DEFAULTS.autoInactivityAlerts,
    autoUpgradeSuggestions:
      parsed.data.autoUpgradeSuggestions ?? AUTOMATION_CENTER_DEFAULTS.autoUpgradeSuggestions,
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
