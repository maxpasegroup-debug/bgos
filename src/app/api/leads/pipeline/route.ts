import type { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prismaKnownErrorResponse, zodValidationErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireAuth } from "@/lib/auth";
import { getCompanyPipelineStatuses } from "@/lib/company-pipeline";
import { leadStatusLabel } from "@/lib/lead-pipeline";
import { serializeLead } from "@/lib/lead-serialize";
import { prisma } from "@/lib/prisma";

const assignInclude = {
  assignee: { select: { id: true, name: true, email: true } as const },
} as const;

const querySchema = z.object({
  leadsPerStage: z.coerce.number().int().min(1).max(500).optional().default(150),
});

/**
 * Full CRM pipeline: counts per stage + lead cards per stage (company-scoped).
 */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  const q = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!q.success) {
    return zodValidationErrorResponse(q.error);
  }

  const { leadsPerStage } = q.data;
  const companyId = session.companyId;

  try {
    const grouped = await prisma.lead.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { _all: true },
    });
    const countByStatus = new Map<LeadStatus, number>();
    for (const g of grouped) {
      countByStatus.set(g.status, g._count._all);
    }

    const pipelineOrder = await getCompanyPipelineStatuses(companyId);
    const stages = await Promise.all(
      pipelineOrder.map(async (status) => {
        const leads = await prisma.lead.findMany({
          where: { companyId, status },
          orderBy: { updatedAt: "desc" },
          take: leadsPerStage,
          include: assignInclude,
        });
        return {
          status,
          label: leadStatusLabel(status),
          count: countByStatus.get(status) ?? 0,
          leads: leads.map(serializeLead),
        };
      }),
    );

    const total = stages.reduce((sum, s) => sum + s.count, 0);

    return NextResponse.json({
      ok: true as const,
      companyId,
      total,
      stages,
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/leads/pipeline", e);
  }
}
