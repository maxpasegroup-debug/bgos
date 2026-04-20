import { IceconnectEmployeeRole, TaskStatus, UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { serializeLead } from "@/lib/lead-serialize";
import { runNexaLeadAutoMovement } from "@/lib/nexa-lead-intelligence";
import { buildRevenueForecast } from "@/lib/nexa-revenue-intelligence";
import { prisma } from "@/lib/prisma";
import { serializeTask } from "@/lib/task-serialize";

const include = {
  user: { select: { id: true, name: true, email: true } as const },
  lead: { select: { id: true, name: true, status: true, companyId: true } as const },
} as const;

async function hierarchyUserIdsForScope(input: {
  companyId: string;
  userId: string;
  iceRole: IceconnectEmployeeRole | null | undefined;
}): Promise<string[]> {
  if (input.iceRole === IceconnectEmployeeRole.BDM) {
    const bdes = await prisma.user.findMany({
      where: {
        parentId: input.userId,
        iceconnectEmployeeRole: IceconnectEmployeeRole.BDE,
        memberships: { some: { companyId: input.companyId, archivedAt: null } },
      },
      select: { id: true },
    });
    return bdes.map((u) => u.id);
  }

  if (input.iceRole === IceconnectEmployeeRole.RSM) {
    const direct = await prisma.user.findMany({
      where: {
        parentId: input.userId,
        iceconnectEmployeeRole: { in: [IceconnectEmployeeRole.BDM, IceconnectEmployeeRole.BDE] },
        memberships: { some: { companyId: input.companyId, archivedAt: null } },
      },
      select: { id: true, iceconnectEmployeeRole: true },
    });
    const bdmIds = direct
      .filter((u) => u.iceconnectEmployeeRole === IceconnectEmployeeRole.BDM)
      .map((u) => u.id);
    const directBdeIds = direct
      .filter((u) => u.iceconnectEmployeeRole === IceconnectEmployeeRole.BDE)
      .map((u) => u.id);
    if (bdmIds.length === 0) return directBdeIds;
    const nestedBdes = await prisma.user.findMany({
      where: {
        parentId: { in: bdmIds },
        iceconnectEmployeeRole: IceconnectEmployeeRole.BDE,
        memberships: { some: { companyId: input.companyId, archivedAt: null } },
      },
      select: { id: true },
    });
    return [...new Set([...directBdeIds, ...nestedBdes.map((u) => u.id)])];
  }

  return [];
}

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, [
    UserRole.SALES_EXECUTIVE,
    UserRole.TELECALLER,
  ]);
  if (session instanceof NextResponse) return session;

  const companyId = session.companyId;
  const hierarchyUserIds = await hierarchyUserIdsForScope({
    companyId,
    userId: session.sub,
    iceRole: session.iceconnectEmployeeRole ?? null,
  });

  const leadOwnershipScope: Prisma.LeadWhereInput[] = [
    { assignedTo: session.sub },
    { ownerUserId: session.sub },
    ...(hierarchyUserIds.length > 0
      ? [{ assignedTo: { in: hierarchyUserIds } }, { ownerUserId: { in: hierarchyUserIds } }]
      : []),
  ];
  const leadWhere: Prisma.LeadWhereInput = {
    companyId,
    OR: leadOwnershipScope,
  };

  const taskWhere: Prisma.TaskWhereInput = isIceconnectPrivileged(session.role)
    ? { companyId }
    : hierarchyUserIds.length > 0
      ? { companyId, OR: [{ userId: session.sub }, { userId: { in: hierarchyUserIds } }] }
      : { companyId, userId: session.sub };

  const now = new Date();

  let leads;
  let tasks;
  let leadCount: number;
  let pendingTaskCount: number;
  let overdueTaskCount: number;
  let nexaSuggestion = "Follow up with priority leads today";
  let nexaPreviewCount = 0;
  let nexaAssistByLeadId = new Map<
    string,
    { suggestion: string; heat: "HOT" | "WARM" | "COLD"; urgencyMessage: string | null; atRisk: boolean }
  >();
  let revenueIntel: {
    expectedRevenueThisMonth: number;
    likelyClosures: number;
    highProbabilityLeads: Array<{ leadId: string; name: string; probability: number; expectedRevenue: number; assignee: string }>;
    riskLeads: Array<{ leadId: string; name: string; probability: number; inactivityHours: number }>;
    alerts: string[];
  } = {
    expectedRevenueThisMonth: 0,
    likelyClosures: 0,
    highProbabilityLeads: [],
    riskLeads: [],
    alerts: [],
  };
  try {
    const taskCountBase = { ...taskWhere, status: TaskStatus.PENDING };
    [leads, tasks, leadCount, pendingTaskCount, overdueTaskCount] = await Promise.all([
      prisma.lead.findMany({
        where: leadWhere,
        orderBy: { createdAt: "desc" },
        take: 80,
        include: {
          assignee: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.task.findMany({
        where: taskWhere,
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        take: 80,
        include,
      }),
      prisma.lead.count({ where: leadWhere }),
      prisma.task.count({ where: taskCountBase }),
      prisma.task.count({
        where: {
          ...taskCountBase,
          dueDate: { lt: now },
        },
      }),
    ]);

    const preview = await runNexaLeadAutoMovement({
      companyId,
      actorUserId: session.sub,
      previewOnly: true,
      onlyAssignedTo: session.sub,
    });
    nexaPreviewCount = preview.preview.length;
    if (preview.preview[0]?.suggestion) nexaSuggestion = preview.preview[0].suggestion;
    nexaAssistByLeadId = new Map(
      preview.preview.map((p) => [
        p.leadId,
        {
          suggestion: p.suggestion,
          heat: p.heat ?? "COLD",
          urgencyMessage: p.urgencyMessage ?? null,
          atRisk: p.atRisk === true,
        },
      ]),
    );

    const forecast = buildRevenueForecast(
      leads.map((l) => ({
        id: l.id,
        name: l.name,
        status: l.status,
        value: l.value,
        assignedTo: l.assignedTo ?? null,
        assigneeName: l.assignee?.name ?? null,
        updatedAt: l.updatedAt,
        lastActivityAt: l.lastActivityAt ?? null,
        activityCount: l.activityCount ?? 0,
        responseStatus: l.responseStatus,
        internalCallStatus: l.internalCallStatus ?? null,
        iceconnectMetroStage: l.iceconnectMetroStage ?? null,
        iceconnectCustomerPlan: l.iceconnectCustomerPlan ?? null,
      })),
    );
    revenueIntel = {
      expectedRevenueThisMonth: forecast.totalExpectedRevenue,
      likelyClosures: forecast.likelyClosures,
      highProbabilityLeads: forecast.highProbabilityLeads,
      riskLeads: forecast.riskLeads,
      alerts: forecast.alerts,
    };
    const leadIntelById = new Map(
      forecast.scoredLeads.map((s) => [s.lead.id, s.intel] as const),
    );
    leads = leads
      .map((l) => ({ ...l, _intel: leadIntelById.get(l.id) ?? null }))
      .sort((a, b) => (b._intel?.priorityRank ?? 0) - (a._intel?.priorityRank ?? 0));
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/iceconnect/sales/data", e);
  }

  return NextResponse.json({
    ok: true as const,
    stats: {
      leadCount,
      pendingTaskCount,
      overdueTaskCount,
    },
    nexa: {
      suggestion: nexaSuggestion,
      previewCount: nexaPreviewCount,
    },
    revenueIntel,
    leads: leads.map((l) => ({
      ...serializeLead({
        ...l,
        assignee: l.assignee,
      }),
      conversionProbability: l._intel?.conversionProbability ?? 0,
      expectedRevenue: l._intel?.expectedRevenue ?? 0,
      predictedCloseDate: l._intel?.predictedCloseDate ?? null,
      probabilityBand: l._intel?.probabilityBand ?? "RISK",
      heat: nexaAssistByLeadId.get(l.id)?.heat ?? "COLD",
      nexaAssistSuggestion: nexaAssistByLeadId.get(l.id)?.suggestion ?? null,
      urgencyMessage: nexaAssistByLeadId.get(l.id)?.urgencyMessage ?? null,
      atRisk: nexaAssistByLeadId.get(l.id)?.atRisk ?? false,
    })),
    tasks: tasks.map(serializeTask),
  });
}
