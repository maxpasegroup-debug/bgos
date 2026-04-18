import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { requireLiveProPlan } from "@/lib/plan-access";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/route-error";
import { ensureSalesBoosterAutomationFlow } from "@/lib/sales-booster-omni";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

const patchSchema = z.object({
  jsonFlow: z.record(z.string(), z.unknown()).optional(),
  autoReplyEnabled: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const user = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (user instanceof NextResponse) return user;
  const pro = await requireLiveProPlan(user);
  if (pro) return pro;
  if (!user.companyId) {
    return NextResponse.json({ ok: false, error: "No company", code: "NO_COMPANY" }, { status: 400 });
  }

  try {
    await ensureSalesBoosterAutomationFlow(user.companyId);
    const row = await prisma.salesBoosterAutomationFlow.findUniqueOrThrow({
      where: { companyId: user.companyId },
    });
    return jsonSuccess({
      jsonFlow: row.jsonFlow,
      autoReplyEnabled: row.autoReplyEnabled,
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (e) {
    return handleApiError("GET /api/sales-booster/omni/automation", e);
  }
}

export async function PATCH(request: NextRequest) {
  const user = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (user instanceof NextResponse) return user;
  const pro = await requireLiveProPlan(user);
  if (pro) return pro;
  if (!user.companyId) {
    return NextResponse.json({ ok: false, error: "No company", code: "NO_COMPANY" }, { status: 400 });
  }

  const parsed = await parseJsonBodyZod(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await ensureSalesBoosterAutomationFlow(user.companyId);
    const row = await prisma.salesBoosterAutomationFlow.update({
      where: { companyId: user.companyId },
      data: {
        ...(parsed.data.jsonFlow !== undefined ? { jsonFlow: parsed.data.jsonFlow as object } : {}),
        ...(parsed.data.autoReplyEnabled !== undefined
          ? { autoReplyEnabled: parsed.data.autoReplyEnabled }
          : {}),
      },
    });
    return jsonSuccess({
      jsonFlow: row.jsonFlow,
      autoReplyEnabled: row.autoReplyEnabled,
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (e) {
    return handleApiError("PATCH /api/sales-booster/omni/automation", e);
  }
}
