import { CompanyPlan, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { requireAuthWithRoles } from "@/lib/auth";
import {
  parseJsonBodyOptional,
  prismaKnownErrorResponse,
  zodValidationErrorResponse,
} from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { isPro } from "@/lib/plan-access";
import { isPlanLockedToBasic } from "@/lib/plan-production-lock";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  note: z.string().trim().max(2000).optional(),
});

const BOSS_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];

/**
 * Monetization funnel: log a Pro / Sales Booster upgrade request (Basic companies only).
 * Reachable on Basic plans — excluded from Pro middleware gate (`PRO_PLAN_SALES_BOOSTER_ALLOWLIST`).
 */
export async function POST(request: NextRequest) {
  const user = await requireAuthWithRoles(request, BOSS_ROLES);
  if (user instanceof NextResponse) return user;

  if (isPlanLockedToBasic()) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Plan upgrades are not available in this deployment.",
        code: "PLAN_UPGRADE_DISABLED" as const,
      },
      { status: 403 },
    );
  }

  if (isPro(user.companyPlan)) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Your workspace is already on a paid plan.",
        code: "ALREADY_PRO",
      },
      { status: 400 },
    );
  }

  const raw = await parseJsonBodyOptional(request);
  if (!raw.ok) return raw.response;

  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { plan: true, name: true },
  });

  if (!company || isPro(company.plan)) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Company is already on a paid plan.",
        code: "ALREADY_PRO",
      },
      { status: 400 },
    );
  }

  try {
    await logActivity(prisma, {
      companyId: user.companyId,
      userId: user.sub,
      type: ACTIVITY_TYPES.SALES_BOOSTER_UPGRADE_REQUEST,
      message: `Sales Booster / Pro upgrade requested by ${user.email}`,
      metadata: {
        companyName: company.name,
        note: parsed.data.note ?? null,
        requestedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST /api/sales-booster/upgrade-request", e);
  }

  return NextResponse.json({
    ok: true as const,
    message:
      "Request recorded. Our team will reach out to activate Pro and Sales Booster on your account.",
  });
}
