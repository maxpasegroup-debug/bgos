import { IceconnectMetroStage, LeadStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { leadPhonesDuplicate } from "@/lib/iceconnect-executive-leads";
import { currentPeriod, METRO_STAGE_LABEL, monthBoundsUTC } from "@/lib/iceconnect-sales-hub";
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

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(5).max(32),
  location: z.string().trim().max(500).optional(),
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

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;

  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const preset = searchParams.get("range")?.trim() ?? null;
  const fromQ = parseDateParam(searchParams.get("from"));
  const toQ = parseDateParam(searchParams.get("to"));
  const pipeline = searchParams.get("pipeline")?.trim() ?? "open";
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

  const assigneeScope = isIceconnectPrivileged(session.role) ? {} : { assignedTo: session.sub };

  const baseWhere = {
    companyId: session.companyId,
    ...assigneeScope,
  };

  const openPipelineWhere = {
    ...baseWhere,
    status: { notIn: [LeadStatus.WON, LeadStatus.LOST] as LeadStatus[] },
    OR: [
      { iceconnectMetroStage: null },
      { iceconnectMetroStage: { not: IceconnectMetroStage.SUBSCRIPTION } },
    ],
  };

  const lostWhere = {
    ...baseWhere,
    status: LeadStatus.LOST,
  };

  const searchClause =
    q.length >= 1
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

  const dateClause = range ? { createdAt: { gte: range.start, lte: range.end } } : {};

  const listWhere =
    pipeline === "lost"
      ? { ...lostWhere, ...dateClause, ...searchClause }
      : { ...openPipelineWhere, ...dateClause, ...searchClause };

  try {
    const { year: periodYear, month: periodMonth } = currentPeriod();
    const { start: monthStart, end: monthEnd } = monthBoundsUTC(periodYear, periodMonth);

    const personalWhere = { companyId: session.companyId, assignedTo: session.sub };

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
          internalSalesNotes: true,
          iceconnectLocation: true,
          iceconnectMetroStage: true,
          nextFollowUpAt: true,
          createdAt: true,
          updatedAt: true,
          assignedTo: true,
          assignee: { select: { id: true, name: true } },
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
      prisma.lead.count({ where: openPipelineWhere }),
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

    return NextResponse.json({
      ok: true as const,
      leads: leads.map((l) => {
        const stage = l.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED;
        const canEdit =
          l.assignedTo === session.sub || isIceconnectPrivileged(session.role);
        return {
          id: l.id,
          name: l.name,
          phone: l.phone,
          location: l.iceconnectLocation ?? "",
          notes: l.internalSalesNotes ?? "",
          stage,
          stageLabel: METRO_STAGE_LABEL[stage],
          status: l.status,
          nextFollowUpAt: l.nextFollowUpAt?.toISOString() ?? null,
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
          assigneeName: l.assignee?.name?.trim() || "—",
          assigneeId: l.assignedTo,
          canEdit,
          won: l.status === LeadStatus.WON,
          lost: l.status === LeadStatus.LOST,
        };
      }),
      stats: {
        openPipelineCount: openTotal,
        conversionsThisMonth,
        targetCount,
        conversionPct,
      },
      view: {
        manager: isIceconnectPrivileged(session.role),
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

  const { name, phone, location, notes } = parsed.data;

  try {
    const peers = await prisma.lead.findMany({
      where: { companyId: session.companyId },
      select: { phone: true },
    });
    if (peers.some((p) => leadPhonesDuplicate(p.phone, phone))) {
      return jsonError(409, "DUPLICATE_PHONE", "A lead with this phone number already exists.");
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        phone,
        companyId: session.companyId,
        assignedTo: session.sub,
        createdByUserId: session.sub,
        status: LeadStatus.NEW,
        iceconnectMetroStage: IceconnectMetroStage.LEAD_CREATED,
        iceconnectLocation: location?.trim() ? location.trim() : null,
        internalSalesNotes: notes?.trim() ? notes.trim() : null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        iceconnectLocation: true,
        internalSalesNotes: true,
        iceconnectMetroStage: true,
        createdAt: true,
        assignedTo: true,
        assignee: { select: { name: true } },
      },
    });

    const stage = lead.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED;

    return NextResponse.json(
      {
        ok: true as const,
        lead: {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          location: lead.iceconnectLocation ?? "",
          notes: lead.internalSalesNotes ?? "",
          stage,
          stageLabel: METRO_STAGE_LABEL[stage],
          status: LeadStatus.NEW,
          createdAt: lead.createdAt.toISOString(),
          assigneeName: lead.assignee?.name?.trim() || "—",
          assigneeId: lead.assignedTo,
          canEdit: true,
          won: false,
          lost: false,
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
