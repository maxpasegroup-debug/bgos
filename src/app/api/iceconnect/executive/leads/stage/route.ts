import { IceconnectMetroStage, LeadStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import {
  flowV3StageFromDb,
  flowV3StageToDb,
  LEAD_FLOW_V3_LABEL,
} from "@/lib/iceconnect-lead-flow-v3";
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
    action: z.literal("set_stage"),
    leadId: z.string().trim().min(1),
    stage: z.enum(["NEW", "INTRODUCED", "DEMO", "FOLLOW_UP", "ONBOARD", "SUBSCRIPTION", "LOST"]),
  }),
  z.object({
    action: z.literal("set_assignee"),
    leadId: z.string().trim().min(1),
    assigneeId: z.string().trim().min(1),
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

    if (parsed.data.action === "set_assignee") {
      if (!isIceconnectPrivileged(session.role)) {
        return jsonError(403, "FORBIDDEN", "Only manager/admin can reassign leads.");
      }
      const membership = await prisma.userCompany.findFirst({
        where: {
          companyId: session.companyId,
          userId: parsed.data.assigneeId,
          jobRole: { in: [UserRole.SALES_EXECUTIVE, UserRole.TELECALLER] },
        },
        select: { userId: true },
      });
      if (!membership) {
        return jsonError(404, "NOT_FOUND", "Assignee not found in sales team.");
      }
      await prisma.lead.update({
        where: { id: leadId },
        data: { assignedTo: parsed.data.assigneeId, internalStageUpdatedAt: new Date() },
      });
      return NextResponse.json({ ok: true as const });
    }

    const selected = parsed.data.stage;
    const now = new Date();
    const updateData =
      selected === "LOST"
        ? {
            status: LeadStatus.LOST,
            internalStageUpdatedAt: now,
          }
        : selected === "SUBSCRIPTION"
          ? {
              iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
              iceconnectSubscribedAt: now,
              status: LeadStatus.WON,
              internalStageUpdatedAt: now,
            }
          : {
              iceconnectMetroStage: flowV3StageToDb(selected),
              status: LeadStatus.NEW,
              internalStageUpdatedAt: now,
            };

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
      select: { id: true, iceconnectMetroStage: true, status: true },
    });

    const outStage =
      updated.status === LeadStatus.LOST
        ? "LOST"
        : flowV3StageFromDb(updated.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED);

    return NextResponse.json({
      ok: true as const,
      lead: {
        id: updated.id,
        stage: outStage,
        stageLabel:
          outStage === "LOST"
            ? "Lost"
            : LEAD_FLOW_V3_LABEL[outStage],
        status: updated.status,
      },
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("PATCH /api/iceconnect/executive/leads/stage", e);
  }
}
