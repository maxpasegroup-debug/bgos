import { LeadStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { assigneeFilter } from "@/lib/iceconnect-scope";
import { leadStatusLabel } from "@/lib/lead-pipeline";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = requireIceconnectRole(request, [UserRole.ENGINEER]);
  if (session instanceof NextResponse) return session;

  const visits = await prisma.lead.findMany({
    where: {
      companyId: session.companyId,
      status: LeadStatus.SITE_VISIT_SCHEDULED,
      ...assigneeFilter(session),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    ok: true as const,
    visits: visits.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      status: l.status,
      statusLabel: leadStatusLabel(l.status),
      value: l.value,
      siteReport: l.siteReport,
      createdAt: l.createdAt.toISOString(),
      assignee: l.assignee,
    })),
  });
}
