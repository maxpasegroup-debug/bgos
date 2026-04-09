import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonSuccess, jsonError, parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  targetRevenueOneMonth: z.number().finite().min(0).max(1e12),
  targetLeadsOneMonth: z.number().int().min(0).max(1_000_000),
});

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  if (!session.companyId) {
    return jsonError(400, "NEEDS_COMPANY", "Create a company first.");
  }

  const row = await prisma.companyGrowthPlan.findUnique({
    where: { companyId: session.companyId },
  });

  return jsonSuccess({
    targetRevenueOneMonth: row?.targetRevenueOneMonth ?? 0,
    targetLeadsOneMonth: row?.targetLeadsOneMonth ?? 0,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  });
}

export async function PATCH(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  if (!session.companyId) {
    return jsonError(400, "NEEDS_COMPANY", "Create a company first.");
  }

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = patchSchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const { targetRevenueOneMonth, targetLeadsOneMonth } = parsed.data;
  const row = await prisma.companyGrowthPlan.upsert({
    where: { companyId: session.companyId },
    create: {
      companyId: session.companyId,
      targetRevenueOneMonth,
      targetLeadsOneMonth,
    },
    update: {
      targetRevenueOneMonth,
      targetLeadsOneMonth,
    },
  });

  return jsonSuccess({
    targetRevenueOneMonth: row.targetRevenueOneMonth,
    targetLeadsOneMonth: row.targetLeadsOneMonth,
    updatedAt: row.updatedAt.toISOString(),
  });
}
