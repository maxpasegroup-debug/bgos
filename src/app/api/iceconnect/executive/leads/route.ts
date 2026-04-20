import {
  CompanyPlan,
  IceconnectMetroStage,
  LeadSourceType,
  LeadStatus,
  UserRole,
} from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { flowV3StageFromDb, LEAD_FLOW_V3_LABEL } from "@/lib/iceconnect-lead-flow-v3";
import { leadPhonesDuplicate } from "@/lib/iceconnect-executive-leads";
import { currentPeriod, monthBoundsUTC } from "@/lib/iceconnect-sales-hub";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { prisma } from "@/lib/prisma";
import { assertIceconnectInternalSalesOrg } from "@/lib/require-iceconnect-internal-org";
import { checkCompanyLimit } from "@/lib/company-limits";
import { touchCompanyUsageAfterLimitsOrPlanChange } from "@/lib/usage-metrics-engine";
import {
  duplicateIdentityResponse,
  findLeadByIdentity,
  normalizeEmail,
  normalizePhone,
  ownershipRoleFromEmployeeRole,
  sourceTypeFromRole,
} from "@/lib/lead-ownership";

const ROLES: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.MANAGER,
  UserRole.TECH_HEAD,
  UserRole.TECH_EXECUTIVE,
];

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(5).max(32),
  email: z.union([z.literal(""), z.string().trim().email().max(320)]).optional(),
  location: z.string().trim().max(500).optional(),
  industry: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(5000).optional(),
});

function parseDateParam(v: string | null): Date | null {
  if (!v?.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function rangeFromPreset(preset: string | null): { start: Date; end: Date } | null {
  const now = new Date();
  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }
  if (preset === "week") {
    const day = now.getDay();
    const diff = (day + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
  return null;
}

function livePlanLabel(plan: CompanyPlan, isTrialActive: boolean): string {
  if (isTrialActive) return "Free Trial";
  if (plan === CompanyPlan.ENTERPRISE) return "Enterprise";
  if (plan === CompanyPlan.PRO) return "Pro";
  return "Basic";
}

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;

  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const preset = searchParams.get("range")?.trim() ?? null;
  const fromQ = parseDateParam(searchParams.get("from"));
  const toQ = parseDateParam(searchParams.get("to"));
  const statusFilter = searchParams.get("statusFilter")?.trim() ?? "active";
  const q = searchParams.get("q")?.trim() ?? "";

  let range: { start: Date; end: Date } | null = null;
  if (preset === "custom" && fromQ && toQ) {
    const start = new Date(fromQ);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toQ);
    end.setHours(23, 59, 59, 999);
    range = { start, end };
  } else if (preset && preset !== "custom") {
    range = rangeFromPreset(preset);
  }

  const workforceManager =
    session.employeeSystem === "ICECONNECT" &&
    (session.iceconnectEmployeeRole === "RSM" || session.iceconnectEmployeeRole === "BDM");
  const managerScope = isIceconnectPrivileged(session.role) || session.role === UserRole.MANAGER || workforceManager;
  const assigneeScope = managerScope ? {} : { assignedTo: session.sub };

  const baseWhere = {
    companyId: session.companyId,
    ...assigneeScope,
  };

  const nonLostWhere = {
    ...baseWhere,
    status: { not: LeadStatus.LOST as LeadStatus },
  };

  const searchClause =
    q.length >= 1
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
            { leadCompanyName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

  const dateClause = range ? { createdAt: { gte: range.start, lte: range.end } } : {};

  const listWhere =
    statusFilter === "lost"
      ? { ...baseWhere, status: LeadStatus.LOST as LeadStatus, ...dateClause, ...searchClause }
      : { ...nonLostWhere, ...dateClause, ...searchClause };

  try {
    const { year: periodYear, month: periodMonth } = currentPeriod();
    const { start: monthStart, end: monthEnd } = monthBoundsUTC(periodYear, periodMonth);

    const personalWhere = { companyId: session.companyId, assignedTo: session.sub };
    const co = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: { plan: true, isTrialActive: true },
    });
    const currentPlanLabel = livePlanLabel(co?.plan ?? CompanyPlan.BASIC, Boolean(co?.isTrialActive));

    const [leads, conversionsThisMonth, openTotal] = await Promise.all([
      prisma.lead.findMany({
        where: listWhere,
        orderBy: { updatedAt: "desc" },
        take: 200,
        select: {
          id: true,
          name: true,
          phone: true,
          status: true,
          leadCompanyName: true,
          businessType: true,
          internalSalesNotes: true,
          iceconnectLocation: true,
          iceconnectMetroStage: true,
          nextFollowUpAt: true,
          createdAt: true,
          updatedAt: true,
          assignedTo: true,
          ownerUserId: true,
          ownerRole: true,
          owner: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true } },
          onboardingRecords: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true },
          },
        },
      }),
      prisma.lead.count({
        where: {
          ...personalWhere,
          iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
          status: LeadStatus.WON,
          iceconnectSubscribedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          status: { not: LeadStatus.LOST as LeadStatus },
          OR: [
            { iceconnectMetroStage: null },
            { iceconnectMetroStage: { not: IceconnectMetroStage.SUBSCRIPTION } },
          ],
        },
      }),
    ]);

    const target = await prisma.salesExecutiveMonthlyTarget.findUnique({
      where: {
        companyId_userId_periodYear_periodMonth: {
          companyId: session.companyId,
          userId: session.sub,
          periodYear,
          periodMonth,
        },
      },
      select: { targetCount: true },
    });
    const targetCount = target?.targetCount ?? 0;
    const conversionPct =
      targetCount > 0 ? Math.min(100, Math.round((conversionsThisMonth / targetCount) * 100)) : 0;

    const mapped = leads.map((l) => {
      const effectiveDbStage = l.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED;
      const stageKey = flowV3StageFromDb(effectiveDbStage);
      const canEdit =
        l.assignedTo === session.sub || isIceconnectPrivileged(session.role);
      const ob = l.onboardingRecords[0];
      return {
        id: l.id,
        name: l.name,
        phone: l.phone,
        companyName: l.leadCompanyName ?? "",
        industry: l.businessType ?? "",
        location: l.iceconnectLocation ?? "",
        notes: l.internalSalesNotes ?? "",
        stage: stageKey,
        stageLabel: LEAD_FLOW_V3_LABEL[stageKey],
        status: l.status,
        nextFollowUpAt: l.nextFollowUpAt?.toISOString() ?? null,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
        assigneeName: l.assignee?.name?.trim() || "—",
        assigneeId: l.assignedTo,
        ownerUserId: l.ownerUserId,
        ownerRole: l.ownerRole,
        ownerName: l.owner?.name ?? null,
        ownerEmail: l.owner?.email ?? null,
        iceconnectMetroStage: effectiveDbStage,
        canEdit,
        won: stageKey === "SUBSCRIPTION",
        lost: l.status === LeadStatus.LOST,
        livePlanLabel: stageKey === "SUBSCRIPTION" ? currentPlanLabel : null,
        onboardingFormId: ob?.id ?? null,
        onboardingIndustry: l.businessType ?? null,
        formStatus: ob?.status === "COMPLETED" ? "Completed" : ob ? "In progress" : "Not started",
        techStatus: null,
      };
    });

    const filtered = mapped.filter((l) => {
      if (statusFilter === "lost") return l.lost;
      if (statusFilter === "live") return l.stage === "SUBSCRIPTION" && !l.lost;
      if (statusFilter === "onboarding") return l.stage === "ONBOARD" && !l.lost;
      return l.stage !== "SUBSCRIPTION" && !l.lost;
    });

    let assignees: { id: string; name: string | null; email: string }[] | undefined;
    if (managerScope) {
      const memberships = await prisma.userCompany.findMany({
        where: {
          companyId: session.companyId,
          jobRole: { in: [UserRole.SALES_EXECUTIVE, UserRole.TELECALLER] },
        },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { name: "asc" } },
      });
      assignees = memberships.map((m) => ({
        id: m.userId,
        name: m.user.name,
        email: m.user.email,
      }));
    }

    return NextResponse.json({
      ok: true as const,
      leads: filtered,
      stats: {
        openPipelineCount: openTotal,
        conversionsThisMonth,
        targetCount,
        conversionPct,
      },
      view: {
        manager: managerScope,
        assignees,
      },
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/iceconnect/executive/leads", e);
  }
}

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;

  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const parsed = await parseJsonBodyZod(request, createSchema);
  if (!parsed.ok) return parsed.response;
  const leadLimit = await checkCompanyLimit(session.companyId, "lead");
  if (!leadLimit.ok) {
    return jsonError(403, "LIMIT_REACHED", leadLimit.message);
  }

  const { name, phone, email, location, industry, notes } = parsed.data;

  try {
    const normalizedPhone = normalizePhone(phone) ?? phone;
    const normalizedEmail = normalizeEmail(email ?? null);
    const exactDup = await findLeadByIdentity({
      companyId: session.companyId,
      phone: normalizedPhone,
      email: normalizedEmail,
    });
    if (exactDup) {
      return NextResponse.json(duplicateIdentityResponse(exactDup), { status: 409 });
    }
    const peers = await prisma.lead.findMany({ where: { companyId: session.companyId }, select: { phone: true } });
    if (peers.some((p) => leadPhonesDuplicate(p.phone, normalizedPhone))) {
      return jsonError(409, "DUPLICATE_PHONE", "Company already exists");
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        phone: normalizedPhone,
        email: normalizedEmail,
        companyId: session.companyId,
        assignedTo: session.sub,
        createdByUserId: session.sub,
        ownerUserId: session.sub,
        ownerRole: ownershipRoleFromEmployeeRole(session.iceconnectEmployeeRole),
        sourceType: sourceTypeFromRole(session.iceconnectEmployeeRole, LeadSourceType.INBOUND),
        sourceUserId: session.sub,
        status: LeadStatus.NEW,
        iceconnectMetroStage: IceconnectMetroStage.LEAD_CREATED,
        businessType: industry?.trim() ? industry.trim() : null,
        iceconnectLocation: location?.trim() ? location.trim() : null,
        internalSalesNotes: notes?.trim() ? notes.trim() : null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        businessType: true,
        iceconnectLocation: true,
        internalSalesNotes: true,
        iceconnectMetroStage: true,
        createdAt: true,
        assignedTo: true,
        ownerUserId: true,
        ownerRole: true,
        owner: { select: { name: true, email: true } },
        assignee: { select: { name: true } },
      },
    });

    const stage = flowV3StageFromDb(lead.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED);
    void touchCompanyUsageAfterLimitsOrPlanChange(session.companyId).catch((e) => {
      console.error("[usage-metrics] failed after executive lead create", e);
    });

    return NextResponse.json(
      {
        ok: true as const,
        lead: {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          companyName: "",
          industry: lead.businessType ?? "",
          location: lead.iceconnectLocation ?? "",
          notes: lead.internalSalesNotes ?? "",
          stage,
          stageLabel: LEAD_FLOW_V3_LABEL[stage],
          status: LeadStatus.NEW,
          createdAt: lead.createdAt.toISOString(),
          updatedAt: lead.createdAt.toISOString(),
          nextFollowUpAt: null,
          assigneeName: lead.assignee?.name?.trim() || "—",
          assigneeId: lead.assignedTo,
          ownerUserId: lead.ownerUserId,
          ownerRole: lead.ownerRole,
          ownerName: lead.owner?.name ?? null,
          ownerEmail: lead.owner?.email ?? null,
          iceconnectMetroStage: lead.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED,
          canEdit: true,
          won: false,
          lost: false,
          livePlanLabel: null,
          onboardingFormId: null,
          onboardingIndustry: null,
          formStatus: "Not started",
          techStatus: null,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST /api/iceconnect/executive/leads", e);
  }
}
