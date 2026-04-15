import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { leadPhonesDuplicate } from "@/lib/iceconnect-executive-leads";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { prisma } from "@/lib/prisma";
import { assertIceconnectInternalSalesOrg } from "@/lib/require-iceconnect-internal-org";

const ROLES: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.MANAGER,
  UserRole.TECH_HEAD,
  UserRole.TECH_EXECUTIVE,
];

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().min(5).max(32).optional(),
  location: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  industry: z.string().trim().max(120).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;

  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const { id } = await ctx.params;
  const parsed = await parseJsonBodyZod(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const lead = await prisma.lead.findFirst({
      where: { id, companyId: session.companyId },
      select: { id: true, assignedTo: true, phone: true },
    });
    if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found.");

    const canEdit = lead.assignedTo === session.sub || isIceconnectPrivileged(session.role);
    if (!canEdit) {
      return jsonError(403, "FORBIDDEN", "Only the assignee or manager can edit this lead.");
    }

    const nextPhone = parsed.data.phone?.trim() ?? lead.phone;
    if (nextPhone !== lead.phone) {
      const peers = await prisma.lead.findMany({
        where: { companyId: session.companyId, NOT: { id: lead.id } },
        select: { phone: true },
      });
      if (peers.some((p) => leadPhonesDuplicate(p.phone, nextPhone))) {
        return jsonError(409, "DUPLICATE_PHONE", "A lead with this phone number already exists.");
      }
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.name != null) data.name = parsed.data.name.trim();
    if (parsed.data.phone != null) data.phone = parsed.data.phone.trim();
    if (parsed.data.location !== undefined) {
      data.iceconnectLocation =
        parsed.data.location && parsed.data.location.trim() ? parsed.data.location.trim() : null;
    }
    if (parsed.data.notes !== undefined) {
      data.internalSalesNotes =
        parsed.data.notes && parsed.data.notes.trim() ? parsed.data.notes.trim() : null;
    }
    if (parsed.data.industry !== undefined) {
      data.businessType =
        parsed.data.industry && parsed.data.industry.trim() ? parsed.data.industry.trim() : null;
    }
    data.internalStageUpdatedAt = new Date();

    await prisma.lead.update({ where: { id }, data });

    return NextResponse.json({ ok: true as const });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("PATCH /api/iceconnect/executive/leads/[id]", e);
  }
}
