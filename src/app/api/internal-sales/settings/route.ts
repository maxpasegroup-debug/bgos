import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import {
  assertInternalSalesSession,
  canManageInternalSalesAssignments,
  loadInternalSalesCompany,
} from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { findUserInCompany } from "@/lib/user-company";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

const patchSchema = z.object({
  defaultAssigneeUserId: z.union([z.string().cuid(), z.null()]).optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (await isCompanyBasicTrialExpired(session.companyId, session.email)) {
    return trialExpiredJsonResponse();
  }

  const co = await loadInternalSalesCompany(ctx.companyId);
  if (!co) return jsonError(404, "NOT_FOUND", "Company not found");

  return jsonSuccess({
    defaultAssigneeUserId: co.internalSalesDefaultAssigneeId,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (!canManageInternalSalesAssignments(session)) {
    return jsonError(403, "FORBIDDEN", "Only a manager can change this");
  }

  if (await isCompanyBasicTrialExpired(session.companyId, session.email)) {
    return trialExpiredJsonResponse();
  }

  const parsed = await parseJsonBodyZod(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.defaultAssigneeUserId === undefined) {
    return jsonError(400, "VALIDATION", "Nothing to update");
  }

  let nextId: string | null = null;
  if (parsed.data.defaultAssigneeUserId !== null) {
    const u = await findUserInCompany(parsed.data.defaultAssigneeUserId, ctx.companyId);
    if (!u) return jsonError(404, "NOT_FOUND", "Team member not found");
    nextId = u.id;
  }

  await prisma.company.update({
    where: { id: ctx.companyId },
    data: { internalSalesDefaultAssigneeId: nextId },
  });

  return jsonSuccess({ defaultAssigneeUserId: nextId });
}
