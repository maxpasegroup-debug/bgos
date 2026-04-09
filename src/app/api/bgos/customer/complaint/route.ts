import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  leadId: z.string().cuid(),
  description: z.string().trim().min(2).max(3000),
});

const patchSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(["PENDING", "RESOLVED"]),
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

  const row = await (prisma as any).customerComplaint.create({
    data: {
      companyId: session.companyId,
      leadId: parsed.data.leadId,
      description: parsed.data.description,
      status: "PENDING",
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

  const row = await (prisma as any).customerComplaint.findFirst({
    where: { id: parsed.data.id, companyId: session.companyId },
    select: { id: true },
  });
  if (!row) return jsonError(404, "NOT_FOUND", "Complaint not found");

  await (prisma as any).customerComplaint.update({
    where: { id: row.id },
    data: { status: parsed.data.status },
  });
  return jsonSuccess({ ok: true });
}
