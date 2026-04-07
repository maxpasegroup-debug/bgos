import { LeadStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({ leadId: z.string().cuid(), assignedTo: z.string().cuid() });

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.OPERATIONS_HEAD, UserRole.SITE_ENGINEER]);
  if (session instanceof NextResponse) return session;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });

  const lead = await prisma.lead.findFirst({ where: { id: body.data.leadId, companyId: session.companyId } });
  if (!lead) return NextResponse.json({ ok: false as const, error: "Lead not found", code: "NOT_FOUND" }, { status: 404 });

  const member = await prisma.userCompany.findUnique({ where: { userId_companyId: { userId: body.data.assignedTo, companyId: session.companyId } } });
  if (!member) return NextResponse.json({ ok: false as const, error: "Assignee not in company", code: "ASSIGNEE_NOT_FOUND" }, { status: 404 });

  const row = await (prisma as any).siteVisit.upsert({
    where: { companyId_leadId: { companyId: session.companyId, leadId: body.data.leadId } },
    update: { assignedTo: body.data.assignedTo, status: "SCHEDULED" },
    create: { companyId: session.companyId, leadId: body.data.leadId, assignedTo: body.data.assignedTo, status: "SCHEDULED" },
  });

  await prisma.lead.update({ where: { id: lead.id }, data: { status: LeadStatus.SITE_VISIT_SCHEDULED, assignedTo: body.data.assignedTo } });
  return NextResponse.json({ ok: true as const, siteVisit: { ...row, createdAt: row.createdAt.toISOString() } });
}
