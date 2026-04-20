import "server-only";

import { LeadOwnershipRole, LeadSourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function normalizeEmail(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  return s.length > 0 ? s : null;
}

export function normalizePhone(v: string | null | undefined): string | null {
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  if (digits.length < 6) return null;
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

export async function findLeadByIdentity(input: {
  companyId: string;
  phone?: string | null;
  email?: string | null;
}) {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  if (!phone && !email) return null;
  return prisma.lead.findFirst({
    where: {
      companyId: input.companyId,
      OR: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      ownerUserId: true,
      ownerRole: true,
      createdByUserId: true,
      assignedTo: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });
}

export function sourceTypeFromRole(
  role: string | null | undefined,
  fallback: LeadSourceType = LeadSourceType.INBOUND,
): LeadSourceType {
  if (role === "RSM") return LeadSourceType.RSM;
  if (role === "BDM") return LeadSourceType.BDM;
  if (role === "BDE") return LeadSourceType.BDE;
  return fallback;
}

export function ownershipRoleFromEmployeeRole(
  role: string | null | undefined,
): LeadOwnershipRole | null {
  if (role === "RSM") return LeadOwnershipRole.RSM;
  if (role === "BDM") return LeadOwnershipRole.BDM;
  if (role === "BDE") return LeadOwnershipRole.BDE;
  return null;
}

export function duplicateIdentityResponse(existing: {
  id: string;
  name: string;
  owner?: { id: string; name: string; email: string } | null;
}) {
  return {
    ok: false as const,
    code: "COMPANY_EXISTS" as const,
    error: "Company already exists",
    options: ["view_existing", "request_ownership"] as const,
    existing: {
      id: existing.id,
      name: existing.name,
      owner: existing.owner ?? null,
    },
  };
}
