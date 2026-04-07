import { ServiceTicketStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({ leadId: z.string().cuid(), issue: z.string().trim().min(1).max(1000), assignedTo: z.string().cuid().optional() });

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.OPERATIONS_HEAD, UserRole.SERVICE_TEAM]);
  if (session instanceof NextResponse) return session;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });

  const lead = await prisma.lead.findFirst({ where: { id: body.data.leadId, companyId: session.companyId } });
  if (!lead) return NextResponse.json({ ok: false as const, error: "Lead not found", code: "NOT_FOUND" }, { status: 404 });

  const hasCompletedInstallation = await (prisma as any).installation.findFirst({ where: { companyId: session.companyId, leadId: body.data.leadId, status: "COMPLETED" }, select: { id: true } });
  if (!hasCompletedInstallation) return NextResponse.json({ ok: false as const, error: "Service allowed only after completed installation", code: "FLOW_BLOCKED" }, { status: 400 });

  const assignedTo = body.data.assignedTo ?? session.sub;
  const m = await prisma.userCompany.findUnique({ where: { userId_companyId: { userId: assignedTo, companyId: session.companyId } } });
  if (!m) return NextResponse.json({ ok: false as const, error: "Assignee not in company", code: "ASSIGNEE_NOT_FOUND" }, { status: 404 });

  const row = await (prisma as any).serviceTicket.create({
    data: { companyId: session.companyId, leadId: body.data.leadId, assignedTo, title: body.data.issue, issue: body.data.issue, description: body.data.issue, status: ServiceTicketStatus.OPEN },
  });

  return NextResponse.json({ ok: true as const, serviceTicket: { ...row, createdAt: row.createdAt.toISOString() } });
}
