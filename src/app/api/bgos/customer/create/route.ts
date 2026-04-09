import { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(6).max(32),
  location: z.string().trim().max(300).optional(),
  password: z.string().min(6).max(128).optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const exists = await prisma.lead.findFirst({
    where: { companyId: session.companyId, phone: parsed.data.phone },
    select: { id: true },
  });
  if (exists) return jsonError(409, "ALREADY_EXISTS", "Customer with this phone already exists");

  const lead = await prisma.lead.create({
    data: {
      companyId: session.companyId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      source: parsed.data.location?.trim() || null,
      status: LeadStatus.WON,
      createdByUserId: session.sub,
      assignedTo: session.sub,
    },
    select: { id: true },
  });

  if (parsed.data.password) {
    const passwordHash = await hashPassword(parsed.data.password);
    await (prisma as any).customerPortalUser.create({
      data: {
        companyId: session.companyId,
        leadId: lead.id,
        mobile: parsed.data.phone,
        passwordHash,
        isActive: true,
      },
    });
  }

  return jsonSuccess({ id: lead.id });
}
