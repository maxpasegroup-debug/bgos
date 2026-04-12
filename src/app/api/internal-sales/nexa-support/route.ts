import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { assertInternalSalesSession } from "@/lib/internal-sales-org";
import { listInternalTechUserIds, notifyInternalUsers } from "@/lib/internal-sales-notifications";
import { prisma } from "@/lib/prisma";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

const bodySchema = z.object({
  leadId: z.string().cuid().optional(),
  option: z.enum(["CALLBACK", "MEETING", "ISSUE"]),
  category: z.enum(["TECHNICAL", "TRAINING", "PAYMENT", "OTHER"]),
  message: z.string().trim().min(1).max(5000),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (await isCompanyBasicTrialExpired(session.companyId, session.email)) {
    return trialExpiredJsonResponse();
  }

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const techIds = await listInternalTechUserIds(ctx.companyId);
  const assignee = techIds[0] ?? null;

  const row = await prisma.internalNexaSupportTicket.create({
    data: {
      companyId: ctx.companyId,
      leadId: parsed.data.leadId ?? null,
      createdByUserId: session.sub,
      option: parsed.data.option,
      category: parsed.data.category,
      message: parsed.data.message,
      assignedToUserId: assignee,
      status: "OPEN",
    },
  });

  if (techIds.length > 0) {
    await notifyInternalUsers({
      companyId: ctx.companyId,
      userIds: techIds,
      type: "NEXA_SUPPORT",
      title: "Nexa support request",
      body: `${parsed.data.category} · ${parsed.data.option}`,
      dedupeKey: `nexa-support:${row.id}`,
    });
  }

  return jsonSuccess({ ok: true as const, ticketId: row.id }, 201);
}
