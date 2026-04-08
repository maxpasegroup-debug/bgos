import { NextResponse } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { runNexaAutoActions } from "@/lib/nexa-engine";
import { requireLiveProPlan } from "@/lib/plan-access";
import { handleApiError } from "@/lib/route-error";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

export async function POST(request: Request) {
  const user = await requireAuthWithCompany(request);
  if (user instanceof NextResponse) return user;

  if (await isCompanyBasicTrialExpired(user.companyId)) {
    return trialExpiredJsonResponse();
  }

  const pro = await requireLiveProPlan(user);
  if (pro) return pro;

  try {
    const created = await runNexaAutoActions(user.companyId, user.sub);
    return jsonSuccess({ created });
  } catch (e) {
    return handleApiError("POST /api/nexa/auto-handle", e);
  }
}
