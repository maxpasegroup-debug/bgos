import { IceconnectMetroStage, LeadStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { METRO_STAGE_LABEL } from "@/lib/iceconnect-sales-hub";
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

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;

  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  try {
    const leads = await prisma.lead.findMany({
      where: {
        companyId: session.companyId,
        assignedTo: session.sub,
        OR: [
          { iceconnectMetroStage: null },
          { iceconnectMetroStage: { not: IceconnectMetroStage.SUBSCRIPTION } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        phone: true,
        internalSalesNotes: true,
        iceconnectLocation: true,
        iceconnectMetroStage: true,
        nextFollowUpAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true as const,
      leads: leads.map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        location: l.iceconnectLocation ?? "",
        notes: l.internalSalesNotes ?? "",
        stage: l.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED,
        stageLabel: METRO_STAGE_LABEL[l.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED],
        nextFollowUpAt: l.nextFollowUpAt?.toISOString() ?? null,
      })),
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
      },
    });

    return NextResponse.json(
      {
        ok: true as const,
        lead: {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          location: lead.iceconnectLocation ?? "",
          notes: lead.internalSalesNotes ?? "",
          stage: lead.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED,
          stageLabel:
            METRO_STAGE_LABEL[lead.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED],
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
