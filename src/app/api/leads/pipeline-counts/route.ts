import { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  internalServerErrorResponse,
  prismaKnownErrorResponse,
} from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { LEAD_PIPELINE_ORDER, leadStatusLabel } from "@/lib/lead-pipeline";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  const companyId = session.companyId;

  let countByStatus: Map<LeadStatus, number>;
  try {
    const grouped = await prisma.lead.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { _all: true },
    });
    countByStatus = new Map<LeadStatus, number>();
    for (const g of grouped) {
      countByStatus.set(g.status, g._count._all);
    }
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    console.error("[GET /api/leads/pipeline-counts]", e);
    return internalServerErrorResponse();
  }

  const stages = LEAD_PIPELINE_ORDER.map((status) => ({
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
