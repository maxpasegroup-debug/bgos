import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import {
  mergeSalesBoosterIntoDashboardConfig,
  parseSalesBoosterFromDashboardConfig,
} from "@/lib/sales-booster-config";
import { requireLiveProPlan } from "@/lib/plan-access";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/route-error";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

const patchSchema = z
  .object({
    onLeadCreated: z.enum(["assign", "whatsapp", "both"]).optional(),
    followUpScheduleEnabled: z.boolean().optional(),
    addonEnabled: z.boolean().optional(),
    aiAutoReplies: z.boolean().optional(),
    campaignAutomation: z.boolean().optional(),
    leadScoring: z.boolean().optional(),
  })
  .strict();

/** Pro+ Sales Booster automation settings (stored in `Company.dashboardConfig.salesBooster`). */
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
    const config = parseSalesBoosterFromDashboardConfig(row?.dashboardConfig);
    return jsonSuccess({ config });
  } catch (e) {
    return handleApiError("GET /api/sales-booster/config", e);
  }
}

export async function PATCH(request: NextRequest) {
  const user = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (user instanceof NextResponse) return user;
  const pro = await requireLiveProPlan(user);
  if (pro) return pro;

  const parsed = await parseJsonBodyZod(request, patchSchema);
  if (!parsed.ok) return parsed.response;
  if (Object.keys(parsed.data).length === 0) {
    return jsonError(400, "VALIDATION_ERROR", "No settings to update");
  }

  try {
    const existing = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { dashboardConfig: true },
    });
    const merged = mergeSalesBoosterIntoDashboardConfig(
      existing?.dashboardConfig,
      parsed.data,
    );
    await prisma.company.update({
      where: { id: user.companyId },
      data: { dashboardConfig: merged },
    });
    const config = parseSalesBoosterFromDashboardConfig(merged as Prisma.JsonValue);
    return jsonSuccess({ config });
  } catch (e) {
    return handleApiError("PATCH /api/sales-booster/config", e);
  }
}
