import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { assertInternalSalesSession, canManageInternalSalesAssignments } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { findUserInCompany } from "@/lib/user-company";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

const dayKeyRegex = /^\d{4}-\d{2}-\d{2}$/;

const patchSchema = z.object({
  userId: z.string().cuid(),
  dayKey: z.string().regex(dayKeyRegex),
  targetCalls: z.number().int().min(0).max(500).optional(),
  targetLeads: z.number().int().min(0).max(500).optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (await isCompanyBasicTrialExpired(session.companyId, session.email)) {
    return trialExpiredJsonResponse();
  }

  const dayKey = request.nextUrl.searchParams.get("dayKey");
  if (!dayKey || !dayKeyRegex.test(dayKey)) {
    return jsonError(400, "VALIDATION", "dayKey=YYYY-MM-DD required");
  }

  const rows = await prisma.internalEmployeeDailyTarget.findMany({
    where: { companyId: ctx.companyId, dayKey },
  });

  return jsonSuccess({ targets: rows });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (!canManageInternalSalesAssignments(session)) {
    return jsonError(403, "FORBIDDEN", "Manager only");
  }

  if (await isCompanyBasicTrialExpired(session.companyId, session.email)) {
    return trialExpiredJsonResponse();
  }

  const parsed = await parseJsonBodyZod(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  const u = await findUserInCompany(parsed.data.userId, ctx.companyId);
  if (!u) return jsonError(404, "NOT_FOUND", "Team member not found");

  if (parsed.data.targetCalls === undefined && parsed.data.targetLeads === undefined) {
    return jsonError(400, "VALIDATION", "targetCalls or targetLeads required");
  }

  const row = await prisma.internalEmployeeDailyTarget.upsert({
    where: {
      companyId_userId_dayKey: {
        companyId: ctx.companyId,
        userId: parsed.data.userId,
        dayKey: parsed.data.dayKey,
      },
    },
    create: {
      companyId: ctx.companyId,
      userId: parsed.data.userId,
      dayKey: parsed.data.dayKey,
      targetCalls: parsed.data.targetCalls ?? 0,
      targetLeads: parsed.data.targetLeads ?? 0,
    },
    update: {
      ...(parsed.data.targetCalls !== undefined ? { targetCalls: parsed.data.targetCalls } : {}),
      ...(parsed.data.targetLeads !== undefined ? { targetLeads: parsed.data.targetLeads } : {}),
    },
  });

  return jsonSuccess({ target: row });
}
