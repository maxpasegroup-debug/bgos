import { LeadStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  leadId: z.string().min(1).max(128),
  report: z.string().min(1).max(20000),
});

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.SITE_ENGINEER]);
  if (session instanceof NextResponse) return session;

  const body = await parseJsonBodyZod(request, bodySchema);
  if (!body.ok) return body.response;

  const { leadId, report } = body.data;

  try {
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        companyId: session.companyId,
        status: LeadStatus.SITE_VISIT_SCHEDULED,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false as const, error: "Visit lead not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    if (!isIceconnectPrivileged(session.role) && lead.assignedTo !== session.sub) {
      return NextResponse.json(
        { ok: false as const, error: "Not assigned to you", code: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: { siteReport: report },
    });

    return NextResponse.json({
      ok: true as const,
      leadId: updated.id,
      siteReportSaved: true,
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST /api/iceconnect/engineer/report", e);
  }
}
