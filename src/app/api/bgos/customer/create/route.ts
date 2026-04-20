import { LeadSourceType, LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { checkCompanyLimit } from "@/lib/company-limits";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { touchCompanyUsageAfterLimitsOrPlanChange } from "@/lib/usage-metrics-engine";
import {
  duplicateIdentityResponse,
  findLeadByIdentity,
  normalizePhone,
  ownershipRoleFromEmployeeRole,
} from "@/lib/lead-ownership";

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
  const leadLimit = await checkCompanyLimit(session.companyId, "lead");
  if (!leadLimit.ok) {
    return jsonError(403, "LIMIT_REACHED", leadLimit.message);
  }

  const normalizedPhone = normalizePhone(parsed.data.phone) ?? parsed.data.phone;
  const exists = await findLeadByIdentity({
    companyId: session.companyId,
    phone: normalizedPhone,
  });
  if (exists) return NextResponse.json(duplicateIdentityResponse(exists), { status: 409 });

  const lead = await prisma.lead.create({
    data: {
      companyId: session.companyId,
      name: parsed.data.name,
      phone: normalizedPhone,
      source: parsed.data.location?.trim() || null,
      status: LeadStatus.WON,
      createdByUserId: session.sub,
      assignedTo: session.sub,
      ownerUserId: session.sub,
      ownerRole:
        ownershipRoleFromEmployeeRole(session.iceconnectEmployeeRole) ??
        ownershipRoleFromEmployeeRole(session.role),
      sourceType: LeadSourceType.INBOUND,
      sourceUserId: session.sub,
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
  void touchCompanyUsageAfterLimitsOrPlanChange(session.companyId).catch((e) => {
    console.error("[usage-metrics] failed after customer create", e);
  });

  return jsonSuccess({ id: lead.id });
}
