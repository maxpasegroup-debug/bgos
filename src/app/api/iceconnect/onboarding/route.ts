import { IceconnectMetroStage, OnboardingStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
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
  leadId: z.string().trim().min(1),
});

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;

  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const assigneeScope = isIceconnectPrivileged(session.role) ? {} : { createdBy: session.sub };

  try {
    const rows = await prisma.onboarding.findMany({
      where: { lead: { companyId: session.companyId }, ...assigneeScope },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        status: true,
        createdAt: true,
        meta: true,
        lead: { select: { id: true, name: true, phone: true, iceconnectMetroStage: true } },
        company: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      ok: true as const,
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        lead: r.lead,
        company: r.company,
        meta: r.meta,
      })),
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/iceconnect/onboarding", e);
  }
}

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;

  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const parsed = await parseJsonBodyZod(request, createSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const lead = await prisma.lead.findFirst({
      where: { id: parsed.data.leadId, companyId: session.companyId },
      select: { id: true, assignedTo: true, iceconnectMetroStage: true },
    });
    if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found.");

    const canStart = lead.assignedTo === session.sub || isIceconnectPrivileged(session.role);
    if (!canStart) {
      return jsonError(403, "FORBIDDEN", "Only the assignee or manager can start onboarding.");
    }

    const stage = lead.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED;
    const order = [
      IceconnectMetroStage.LEAD_CREATED,
      IceconnectMetroStage.INTRO_CALL,
      IceconnectMetroStage.DEMO_DONE,
      IceconnectMetroStage.FOLLOW_UP,
      IceconnectMetroStage.ONBOARDING,
      IceconnectMetroStage.PAYMENT_DONE,
      IceconnectMetroStage.SUBSCRIPTION,
    ];
    const idx = order.indexOf(stage);
    const demoIdx = order.indexOf(IceconnectMetroStage.DEMO_DONE);
    if (idx < demoIdx) {
      return jsonError(400, "LEAD_NOT_READY", "Lead must be at Demo stage or later.");
    }

    const existing = await prisma.onboarding.findFirst({
      where: { leadId: lead.id, status: OnboardingStatus.IN_PROGRESS },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true as const, id: existing.id, existing: true as const });
    }

    const created = await prisma.onboarding.create({
      data: {
        leadId: lead.id,
        createdBy: session.sub,
        status: OnboardingStatus.IN_PROGRESS,
        meta: {},
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true as const, id: created.id }, { status: 201 });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST /api/iceconnect/onboarding", e);
  }
}
