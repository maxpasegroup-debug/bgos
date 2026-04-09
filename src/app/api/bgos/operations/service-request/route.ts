import { ServiceTicketStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  leadId: z.string().cuid(),
  issue: z.string().trim().min(1).max(1000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  assignedToUserId: z.string().cuid().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const { leadId, issue, priority, assignedToUserId } = parsed.data;
  const [lead, doneInstall] = await Promise.all([
    prisma.lead.findFirst({ where: { id: leadId, companyId: session.companyId } }),
    (prisma as any).installation.findFirst({
      where: { companyId: session.companyId, leadId, status: "COMPLETED" },
      select: { id: true },
    }),
  ]);
  if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");
  if (!doneInstall) return jsonError(400, "FLOW_BLOCKED", "Service allowed after completed installation");

  const assignedTo = assignedToUserId ?? session.sub;
  const member = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: assignedTo, companyId: session.companyId } },
  });
  if (!member) return jsonError(404, "ASSIGNEE_NOT_FOUND", "Assignee not in company");

  const description = `[PRIORITY:${priority}] ${issue}`;
  const row = await (prisma as any).serviceTicket.create({
    data: {
      companyId: session.companyId,
      leadId,
      assignedTo,
      title: issue,
      issue,
      description,
      status: ServiceTicketStatus.OPEN,
    },
  });
  return jsonSuccess({ serviceTicketId: row.id });
}
