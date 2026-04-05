import { CompanyPlan } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { proPlanRequiredResponse } from "@/lib/plan-access";

/**
 * Pro-only automation surface (middleware also enforces plan).
 * BASIC receives 403 before this handler runs.
 */
export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  if (user.companyPlan !== CompanyPlan.PRO) {
    return proPlanRequiredResponse();
  }

  return NextResponse.json({
    ok: true as const,
    plan: user.companyPlan,
    automation: "simulated_active",
    channels: ["whatsapp_simulation"],
    message: "Automation endpoints are available on Pro (simulated in this build).",
  });
}
