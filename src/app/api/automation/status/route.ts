import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { companyPlanToJwt, requireLiveProPlan } from "@/lib/plan-access";
import { handleApiError } from "@/lib/route-error";

/**
 * Pro+ automation surface (PRO or ENTERPRISE). Middleware blocks Basic; this handler
 * confirms {@link Company.plan} still qualifies (downgrades apply without re-login).
 */
export async function GET(request: NextRequest) {
  const user = await requireAuthWithCompany(request);
  if (user instanceof NextResponse) return user;

  try {
    const plan = await requireLiveProPlan(user);
    if (plan) return plan;
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/automation/status", e);
  }

  return NextResponse.json({
    ok: true as const,
    plan: companyPlanToJwt(user.companyPlan),
    automation: "simulated_active",
    channels: ["whatsapp_simulation"],
    message:
      "Automation endpoints are available on Pro+; channel automations require Enterprise (simulated in this build).",
  });
}
