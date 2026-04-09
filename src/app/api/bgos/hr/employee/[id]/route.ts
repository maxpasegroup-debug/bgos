import { LeadStatus, TaskStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { isHrManagerRole } from "@/lib/hr";
import { prisma } from "@/lib/prisma";

function roleLabel(role: string): string {
  if (role === "ADMIN") return "Boss";
  return role
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (!isHrManagerRole(session.role)) return jsonError(403, "FORBIDDEN", "Forbidden");

  const { id } = await context.params;
  const member = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: id, companyId: session.companyId } },
    select: {
      userId: true,
      jobRole: true,
      user: { select: { id: true, name: true, mobile: true, createdAt: true, isActive: true } },
    },
  });
  if (!member) return jsonError(404, "NOT_FOUND", "Employee not found");

  const [leadsHandled, leadsConverted, tasksCompleted, taskAssigned, pips] = await Promise.all([
    prisma.lead.count({ where: { companyId: session.companyId, assignedTo: id } }),
    prisma.lead.count({
      where: { companyId: session.companyId, assignedTo: id, status: LeadStatus.WON },
    }),
    prisma.task.count({
      where: { companyId: session.companyId, userId: id, status: TaskStatus.COMPLETED },
    }),
    prisma.task.count({ where: { companyId: session.companyId, userId: id } }),
    (prisma as any).employeePip.findMany({
      where: { companyId: session.companyId, userId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const conversionPercent = leadsHandled > 0 ? Math.round((leadsConverted / leadsHandled) * 100) : 0;
  const efficiencyPercent = taskAssigned > 0 ? Math.round((tasksCompleted / taskAssigned) * 100) : 0;

  return jsonSuccess({
    employee: {
      id: member.user.id,
      name: member.user.name,
      phone: member.user.mobile ?? "",
      role: member.jobRole,
      roleLabel: roleLabel(member.jobRole),
      joiningDate: member.user.createdAt.toISOString(),
      active: member.user.isActive,
    },
    performance: {
      leadsHandled,
      tasksCompleted,
      conversionPercent,
      efficiencyPercent,
    },
    pips: pips.map((p: any) => ({
      id: p.id,
      goal: p.goal,
      progress: p.progress,
      isCompleted: p.isCompleted,
      dueDate: p.dueDate ? new Date(p.dueDate).toISOString() : null,
      createdAt: new Date(p.createdAt).toISOString(),
    })),
  });
}
