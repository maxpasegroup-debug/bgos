import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { assertInternalSalesSession, leadVisibilityFilter } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const internalCtx = await assertInternalSalesSession(session);
  if (internalCtx instanceof Response) return internalCtx;

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  const { id: leadId } = await ctx.params;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId: internalCtx.companyId },
    select: { id: true, assignedTo: true },
  });
  if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");

  const vis = leadVisibilityFilter(session);
  if ("assignedTo" in vis && lead.assignedTo !== session.sub) {
    return jsonError(403, "FORBIDDEN", "You can only view your own leads");
  }

  const rows = await prisma.internalLeadActivity.findMany({
    where: { leadId, companyId: internalCtx.companyId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { id: true, name: true } } },
  });

  return jsonSuccess({
    activity: rows.map((r) => ({
      id: r.id,
      action: r.action,
      detail: r.detail,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
      user: r.user ? { id: r.user.id, name: r.user.name } : null,
    })),
  });
}
