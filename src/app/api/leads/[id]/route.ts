import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { serializeLead } from "@/lib/lead-serialize";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Single lead for company (quotation builder, detail panels).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;

  try {
    const lead = await prisma.lead.findFirst({
      where: { id, companyId: session.companyId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false as const, error: "Lead not found", code: "NOT_FOUND" as const },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true as const,
      lead: serializeLead(lead),
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/leads/[id]", e);
  }
}
