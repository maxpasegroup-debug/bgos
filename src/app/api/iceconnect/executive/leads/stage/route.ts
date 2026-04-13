import {
  IceconnectCustomerPlan,
  IceconnectMetroStage,
  LeadStatus,
  UserRole,
} from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { METRO_STAGE_LABEL, nextMetroStage } from "@/lib/iceconnect-sales-hub";
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

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("advance"),
    leadId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("subscribe"),
    leadId: z.string().trim().min(1),
    customerPlan: z.nativeEnum(IceconnectCustomerPlan),
  }),
  z.object({
    action: z.literal("mark_lost"),
    leadId: z.string().trim().min(1),
  }),
]);

export async function PATCH(request: NextRequest) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;

  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { leadId } = parsed.data;

  try {
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        companyId: session.companyId,
      },
      select: {
        id: true,
        assignedTo: true,
        iceconnectMetroStage: true,
        status: true,
      },
    });

    if (!lead) {
      return jsonError(404, "NOT_FOUND", "Lead not found.");
    }

    const canEdit =
      lead.assignedTo === session.sub || isIceconnectPrivileged(session.role);
    if (!canEdit) {
      return jsonError(403, "FORBIDDEN", "Only the assigned executive (or a manager) can update this lead.");
    }

    const current = lead.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED;

    if (parsed.data.action === "mark_lost") {
      if (lead.status === LeadStatus.WON) {
        return jsonError(400, "INVALID_STATUS", "Cannot mark a converted customer as lost.");
      }
      const now = new Date();
      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: {
          status: LeadStatus.LOST,
          internalStageUpdatedAt: now,
        },
        select: { id: true, status: true },
      });
      return NextResponse.json({
        ok: true as const,
        lead: { id: updated.id, status: updated.status },
      });
    }

    if (parsed.data.action === "subscribe") {
      const okStage =
        current === IceconnectMetroStage.PAYMENT_DONE ||
        current === IceconnectMetroStage.ONBOARDING;
      if (!okStage) {
        return jsonError(
          400,
          "INVALID_STAGE",
          "Complete payment stage before converting to customer.",
        );
      }
      const now = new Date();
      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: {
          iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
          iceconnectCustomerPlan: parsed.data.customerPlan,
          iceconnectSubscribedAt: now,
          status: LeadStatus.WON,
          internalStageUpdatedAt: now,
        },
        select: {
          id: true,
          iceconnectMetroStage: true,
          iceconnectCustomerPlan: true,
        },
      });
      return NextResponse.json({
        ok: true as const,
        lead: {
          id: updated.id,
          stage: updated.iceconnectMetroStage,
          stageLabel: METRO_STAGE_LABEL[updated.iceconnectMetroStage!],
          customerPlan: updated.iceconnectCustomerPlan,
        },
      });
    }

    const nxt = nextMetroStage(current);
    if (nxt == null) {
      return jsonError(400, "ALREADY_FINAL", "Lead is already at the final stage.");
    }
    if (nxt === IceconnectMetroStage.SUBSCRIPTION) {
      return jsonError(
        400,
        "USE_SUBSCRIBE",
        "Confirm plan and convert to customer to complete this lead.",
      );
    }

    const now = new Date();
    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: {
        iceconnectMetroStage: nxt,
        internalStageUpdatedAt: now,
      },
      select: {
        id: true,
        iceconnectMetroStage: true,
      },
    });

    return NextResponse.json({
      ok: true as const,
      lead: {
        id: updated.id,
        stage: updated.iceconnectMetroStage,
        stageLabel: METRO_STAGE_LABEL[updated.iceconnectMetroStage!],
      },
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("PATCH /api/iceconnect/executive/leads/stage", e);
  }
}
