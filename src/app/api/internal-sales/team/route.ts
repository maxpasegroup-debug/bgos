import type { NextRequest } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { assertInternalSalesSession, listInternalSalesTeamMembers } from "@/lib/internal-sales-org";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  const team = await listInternalSalesTeamMembers(ctx.companyId);
  return jsonSuccess({ team });
}
