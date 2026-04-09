import { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  leadId: z.string().cuid(),
  date: z.string().min(1),
  assignEngineerUserId: z.string().cuid(),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const { leadId, date, assignEngineerUserId } = parsed.data;

  const [lead, member] = await Promise.all([
    prisma.lead.findFirst({ where: { id: leadId, companyId: session.companyId } }),
    prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: assignEngineerUserId, companyId: session.companyId } },
    }),
  ]);
  if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");
  if (!member) return jsonError(404, "ASSIGNEE_NOT_FOUND", "Engineer not in company");

  const row = await (prisma as any).siteVisit.upsert({
    where: { companyId_leadId: { companyId: session.companyId, leadId } },
    update: {
      assignedTo: assignEngineerUserId,
      status: "SCHEDULED",
      report: { date },
    },
    create: {
      companyId: session.companyId,
      leadId,
      assignedTo: assignEngineerUserId,
      status: "SCHEDULED",
      report: { date },
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: LeadStatus.SITE_VISIT_SCHEDULED, assignedTo: assignEngineerUserId },
  });

  return jsonSuccess({ siteVisitId: row.id });
}
