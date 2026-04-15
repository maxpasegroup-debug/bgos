import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { jsonSuccess, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import {
  mergeAutomationCenterIntoDashboardConfig,
  parseAutomationCenterFromDashboardConfig,
} from "@/lib/automation-center-config";
import { requireLiveProPlan } from "@/lib/plan-access";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/route-error";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

const patchSchema = z
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

/**
 * Automation Center master toggle (stored in `Company.dashboardConfig.automationCenter`).
 * Pro+ only; ADMIN/MANAGER.
 */
export async function PATCH(request: NextRequest) {
  const user = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (user instanceof NextResponse) return user;
  const pro = await requireLiveProPlan(user);
  if (pro) return pro;

  const parsed = await parseJsonBodyZod(request, patchSchema);
  if (!parsed.ok) return parsed.response;
  if (parsed.data.autonomyLevel && parsed.data.autonomyLevel !== "LEVEL_2") {
    return NextResponse.json(
      { ok: false as const, code: "LEVEL_NOT_AVAILABLE" as const, error: "Only Level 2 is available now." },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { dashboardConfig: true },
    });
    const merged = mergeAutomationCenterIntoDashboardConfig(existing?.dashboardConfig, {
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.autonomyLevel ? { autonomyLevel: parsed.data.autonomyLevel } : {}),
      ...(parsed.data.autoAssignLeads !== undefined
        ? { autoAssignLeads: parsed.data.autoAssignLeads }
        : {}),
      ...(parsed.data.autoReminders !== undefined
        ? { autoReminders: parsed.data.autoReminders }
        : {}),
      ...(parsed.data.autoTaskCreation !== undefined
        ? { autoTaskCreation: parsed.data.autoTaskCreation }
        : {}),
      ...(parsed.data.autoInactivityAlerts !== undefined
        ? { autoInactivityAlerts: parsed.data.autoInactivityAlerts }
        : {}),
      ...(parsed.data.autoUpgradeSuggestions !== undefined
        ? { autoUpgradeSuggestions: parsed.data.autoUpgradeSuggestions }
        : {}),
    });
    await prisma.company.update({
      where: { id: user.companyId },
      data: { dashboardConfig: merged },
    });
    return jsonSuccess(parseAutomationCenterFromDashboardConfig(merged as Prisma.JsonValue));
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("PATCH /api/automation/settings", e);
  }
}

export async function GET(request: NextRequest) {
  const user = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (user instanceof NextResponse) return user;
  const pro = await requireLiveProPlan(user);
  if (pro) return pro;

  try {
    const row = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { dashboardConfig: true },
    });
    return jsonSuccess(parseAutomationCenterFromDashboardConfig(row?.dashboardConfig));
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/automation/settings", e);
  }
}
