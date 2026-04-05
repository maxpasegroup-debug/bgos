import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { requireLiveProPlan } from "@/lib/plan-access";
import { handleApiError } from "@/lib/route-error";

/**
 * Pro-only automation surface. Middleware blocks Basic JWTs; this handler confirms
 * {@link Company.plan} is still Pro (downgrades apply without waiting for re-login).
 */
export async function GET(request: NextRequest) {
  const user = requireAuth(request);
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
    plan: "PRO" as const,
    automation: "simulated_active",
    channels: ["whatsapp_simulation"],
    message: "Automation endpoints are available on Pro (simulated in this build).",
  });
}
