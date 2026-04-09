import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

const createSchema = z.object({
  leadId: z.string().cuid(),
  loanAmount: z.number().positive(),
  notes: z.string().max(4000).optional(),
});

const patchSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  notes: z.string().max(4000).optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = createSchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, companyId: session.companyId },
    select: { id: true },
  });
  if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");

  const row = await (prisma as any).lcoLoan.create({
    data: {
      companyId: session.companyId,
      leadId: parsed.data.leadId,
      loanAmount: parsed.data.loanAmount,
      status: "PENDING",
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
    },
  });
  return jsonSuccess({ id: row.id });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = patchSchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const row = await (prisma as any).lcoLoan.findFirst({
    where: { id: parsed.data.id, companyId: session.companyId },
    select: { id: true },
  });
  if (!row) return jsonError(404, "NOT_FOUND", "LCO row not found");

  await (prisma as any).lcoLoan.update({
    where: { id: row.id },
    data: {
      status: parsed.data.status,
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    },
  });
  return jsonSuccess({ ok: true });
}
