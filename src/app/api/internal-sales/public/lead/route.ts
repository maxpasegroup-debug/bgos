import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import {
  findDuplicateInternalLeadDetailed,
  getOrCreateInternalSalesCompanyId,
  internalStageToLeadStatus,
  normalizeInternalSalesEmail,
  normalizeInternalSalesPhone,
} from "@/lib/internal-sales-org";
import { INTERNAL_ACTIVITY, logInternalLeadActivity } from "@/lib/internal-sales-activity";
import { listInternalManagerUserIds, notifyInternalUsers } from "@/lib/internal-sales-notifications";
import { prisma } from "@/lib/prisma";
import { InternalCallStatus, InternalSalesStage } from "@prisma/client";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  companyName: z.string().trim().max(200).optional(),
  phone: z.string().trim().min(1).max(32),
  email: z.union([z.string().trim().email().max(320), z.literal("")]).optional(),
  businessType: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const resolved = await getOrCreateInternalSalesCompanyId();
  if ("error" in resolved) {
    return jsonError(503, "NOT_READY", resolved.error);
  }
  const { companyId } = resolved;

  const normalized = normalizeInternalSalesPhone(parsed.data.phone);
  if (!normalized) {
    return jsonError(400, "VALIDATION", "Phone is required");
  }

  const emailNorm = normalizeInternalSalesEmail(
    parsed.data.email && parsed.data.email.trim() !== "" ? parsed.data.email : null,
  );

  const dup = await findDuplicateInternalLeadDetailed(companyId, {
    normalizedPhone: normalized,
    normalizedEmail: emailNorm,
  });
  if (dup) {
    return jsonError(409, "DUPLICATE", "Lead already exists", {
      match: dup.match,
      existingLead: { id: dup.id, name: dup.name, phone: dup.phone, email: dup.email },
    });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { internalSalesDefaultAssigneeId: true },
  });

  let assignedTo: string | null = company?.internalSalesDefaultAssigneeId ?? null;
  if (assignedTo) {
    const m = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: assignedTo, companyId } },
    });
    if (!m) assignedTo = null;
  }

  const email =
    parsed.data.email && parsed.data.email.trim() !== "" ? parsed.data.email.trim() : null;

  const lead = await prisma.lead.create({
    data: {
      name: parsed.data.name.trim(),
      phone: normalized,
      email,
      leadCompanyName: parsed.data.companyName?.trim() || undefined,
      businessType: parsed.data.businessType?.trim() || undefined,
      internalSalesNotes: parsed.data.notes?.trim() || undefined,
      companyId,
      assignedTo: assignedTo ?? undefined,
      createdByUserId: undefined,
      source: "public",
      status: internalStageToLeadStatus(InternalSalesStage.LEAD_ADDED),
      internalSalesStage: InternalSalesStage.LEAD_ADDED,
      internalCallStatus: InternalCallStatus.NOT_CALLED,
      internalStageUpdatedAt: new Date(),
    },
    select: { id: true },
  });

  await logInternalLeadActivity({
    companyId,
    leadId: lead.id,
    userId: null,
    action: INTERNAL_ACTIVITY.CREATED,
    detail: `Public lead: ${parsed.data.name.trim()}`,
  });

  if (assignedTo) {
    await notifyInternalUsers({
      companyId,
      userIds: [assignedTo],
      type: "LEAD_ASSIGNED",
      title: "New lead",
      body: `${parsed.data.name.trim()} — from public form.`,
      dedupeKey: `assign:${lead.id}:${assignedTo}`,
    });
  } else {
    const managers = await listInternalManagerUserIds(companyId);
    if (managers.length > 0) {
      await notifyInternalUsers({
        companyId,
        userIds: managers,
        type: "NEW_PUBLIC_LEAD",
        title: "New public lead",
        body: `${parsed.data.name.trim()} — unassigned.`,
        dedupeKey: `public-lead:${lead.id}`,
      });
    }
  }

  return jsonSuccess({ id: lead.id, message: "Thank you. We will contact you soon." }, 201);
}
