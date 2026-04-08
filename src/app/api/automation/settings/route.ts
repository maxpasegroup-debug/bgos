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
    enabled: z.boolean(),
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

  try {
    const existing = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { dashboardConfig: true },
    });
    const merged = mergeAutomationCenterIntoDashboardConfig(existing?.dashboardConfig, {
      enabled: parsed.data.enabled,
    });
    await prisma.company.update({
      where: { id: user.companyId },
      data: { dashboardConfig: merged },
    });
    const { enabled } = parseAutomationCenterFromDashboardConfig(merged as Prisma.JsonValue);
    return jsonSuccess({ enabled });
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
    const { enabled } = parseAutomationCenterFromDashboardConfig(row?.dashboardConfig);
    return jsonSuccess({ enabled });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/automation/settings", e);
  }
}
