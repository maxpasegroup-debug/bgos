import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { assertInternalSalesSession } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const internalCtx = await assertInternalSalesSession(session);
  if (internalCtx instanceof Response) return internalCtx;

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  const { id } = await ctx.params;

  const n = await prisma.internalInAppNotification.findFirst({
    where: { id, companyId: internalCtx.companyId, userId: session.sub },
  });
  if (!n) return jsonError(404, "NOT_FOUND", "Not found");

  await prisma.internalInAppNotification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return jsonSuccess({ ok: true });
}
