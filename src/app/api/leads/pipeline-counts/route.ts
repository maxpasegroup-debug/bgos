import { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireAuth } from "@/lib/auth";
import { getCompanyPipelineStatuses } from "@/lib/company-pipeline";
import { leadStatusLabel } from "@/lib/lead-pipeline";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  const companyId = session.companyId;

  let countByStatus: Map<LeadStatus, number>;
  let pipelineOrder: LeadStatus[];
  try {
    const [grouped, order] = await Promise.all([
      prisma.lead.groupBy({
        by: ["status"],
        where: { companyId },
        _count: { _all: true },
      }),
      getCompanyPipelineStatuses(companyId),
    ]);
    pipelineOrder = order;
    countByStatus = new Map<LeadStatus, number>();
    for (const g of grouped) {
      countByStatus.set(g.status, g._count._all);
    }
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/leads/pipeline-counts", e);
  }
  const stages = pipelineOrder.map((status) => ({
    status,
    label: leadStatusLabel(status),
    count: countByStatus.get(status) ?? 0,
  }));

  const total = stages.reduce((sum, s) => sum + s.count, 0);

  return NextResponse.json({
    ok: true as const,
    companyId,
    total,
    stages,
  });
}
