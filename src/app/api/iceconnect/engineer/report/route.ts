import { LeadStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  leadId: z.string().min(1),
  report: z.string().min(1).max(20000),
});

export async function POST(request: NextRequest) {
  const session = requireIceconnectRole(request, [UserRole.ENGINEER]);
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const { leadId, report } = parsed.data;

  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      companyId: session.companyId,
      status: LeadStatus.VISIT,
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
}
