import type { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseLeadsQuery } from "@/lib/api-query";
import { prismaKnownErrorResponse, zodValidationErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireAuthWithCompany } from "@/lib/auth";
import { serializeLead } from "@/lib/lead-serialize";
import { prisma } from "@/lib/prisma";
import { findUserInCompany } from "@/lib/user-company";

const assignInclude = {
  assignee: { select: { id: true, name: true, email: true } as const },
} as const;

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const parsedQ = parseLeadsQuery(request);
  if (!parsedQ.success) {
    return zodValidationErrorResponse(parsedQ.error);
  }

  const { status: statusParam, assignedTo, limit: take, offset: skip } = parsedQ.data;

  const where: {
    companyId: string;
    status?: LeadStatus;
    assignedTo?: string;
  } = { companyId: session.companyId };

  if (statusParam) {
    where.status = statusParam;
  }

  if (assignedTo === "me") {
    where.assignedTo = session.sub;
  } else if (assignedTo) {
    const member = await findUserInCompany(assignedTo, session.companyId);
    if (!member) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "User is not part of this company",
          code: "INVALID_ASSIGNEE_FILTER" as const,
        },
        { status: 400 },
      );
    }
    where.assignedTo = assignedTo;
  }

  let leads;
  let total: number;
  try {
    [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: assignInclude,
      }),
      prisma.lead.count({ where }),
    ]);
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/leads", e);
  }

  return NextResponse.json({
    ok: true as const,
    leads: leads.map(serializeLead),
    total,
    limit: take,
    offset: skip,
  });
}
