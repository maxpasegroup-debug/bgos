import { ServiceTicketStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  leadId: z.string().cuid(),
  issue: z.string().trim().min(1).max(1000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

const patchSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = postSchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, companyId: session.companyId },
    select: { id: true },
  });
  if (!lead) return jsonError(404, "NOT_FOUND", "Customer not found");

  const row = await (prisma as any).serviceTicket.create({
    data: {
      companyId: session.companyId,
      leadId: parsed.data.leadId,
      assignedTo: session.sub,
      title: parsed.data.issue,
      issue: parsed.data.issue,
      description: `[PRIORITY:${parsed.data.priority}] ${parsed.data.issue}`,
      status: ServiceTicketStatus.OPEN,
    },
  });
  return jsonSuccess({ id: row.id });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = patchSchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const row = await (prisma as any).serviceTicket.findFirst({
    where: { id: parsed.data.id, companyId: session.companyId },
    select: { id: true },
  });
  if (!row) return jsonError(404, "NOT_FOUND", "Service request not found");

  const nextStatus =
    parsed.data.status === "CLOSED"
      ? ServiceTicketStatus.RESOLVED
      : ServiceTicketStatus.OPEN;
  const nextDescPrefix = parsed.data.status === "IN_PROGRESS" ? "[IN_PROGRESS] " : "";
  await (prisma as any).serviceTicket.update({
    where: { id: row.id },
    data: {
      status: nextStatus,
      ...(parsed.data.status === "CLOSED" ? { resolvedAt: new Date() } : {}),
      ...(parsed.data.status === "IN_PROGRESS" ? { description: `${nextDescPrefix}` } : {}),
    },
  });
  return jsonSuccess({ ok: true });
}
