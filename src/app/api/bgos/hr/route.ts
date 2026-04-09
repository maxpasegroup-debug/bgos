import { LeadStatus, TaskStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { isHrManagerRole, startOfDayLocal } from "@/lib/hr";
import { prisma } from "@/lib/prisma";

function roleLabel(role: string): string {
  if (role === "ADMIN") return "Boss";
  return role
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (!isHrManagerRole(session.role)) {
    return jsonError(403, "FORBIDDEN", "Only HR manager roles can view this page.");
  }

  const filter = request.nextUrl.searchParams.get("filter")?.trim() ?? "all";
  const day = startOfDayLocal(new Date());
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  const [members, todayAttendance, currentLeaves, pips] = await Promise.all([
    prisma.userCompany.findMany({
      where: { companyId: session.companyId, user: { isActive: true } },
      select: {
        userId: true,
        jobRole: true,
        user: { select: { id: true, name: true, mobile: true, createdAt: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
    (prisma as any).attendance.findMany({
      where: {
        companyId: session.companyId,
        date: day,
      },
      select: { userId: true, checkIn: true, checkOut: true },
    }),
    (prisma as any).leaveRequest.findMany({
      where: {
        companyId: session.companyId,
        status: "APPROVED",
        fromDate: { lte: nextDay },
        toDate: { gte: day },
      },
      select: { userId: true },
    }),
    (prisma as any).employeePip.findMany({
      where: { companyId: session.companyId, isCompleted: false },
      select: { userId: true },
    }),
  ]);

  const userIds = members.map((m) => m.userId);
  const [leadAgg, wonAgg, taskAgg] = await Promise.all([
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: { companyId: session.companyId, assignedTo: { in: userIds } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: {
        companyId: session.companyId,
        assignedTo: { in: userIds },
        status: LeadStatus.WON,
      },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["userId"],
      where: {
        companyId: session.companyId,
        userId: { in: userIds },
        status: TaskStatus.COMPLETED,
      },
      _count: { _all: true },
    }),
  ]);

  const leadMap = new Map<string, number>();
  const wonMap = new Map<string, number>();
  const taskMap = new Map<string, number>();
  for (const r of leadAgg) if (r.assignedTo) leadMap.set(r.assignedTo, r._count._all);
  for (const r of wonAgg) if (r.assignedTo) wonMap.set(r.assignedTo, r._count._all);
  for (const r of taskAgg) if (r.userId) taskMap.set(r.userId, r._count._all);

  const onLeave = new Set<string>(currentLeaves.map((l: { userId: string }) => l.userId));
  const attendanceMap = new Map<string, { checkIn: Date | null; checkOut: Date | null }>();
  for (const a of todayAttendance as any[]) {
    attendanceMap.set(a.userId, { checkIn: a.checkIn, checkOut: a.checkOut });
  }
  const pipUsers = new Set<string>(pips.map((p: any) => p.userId));

  let employees = members.map((m) => {
    const leadsHandled = leadMap.get(m.userId) ?? 0;
    const leadsConverted = wonMap.get(m.userId) ?? 0;
    const tasksCompleted = taskMap.get(m.userId) ?? 0;
    const conversionPercent = leadsHandled > 0 ? Math.round((leadsConverted / leadsHandled) * 100) : 0;
    const efficiencyPercent = Math.min(100, Math.round((tasksCompleted / Math.max(1, leadsHandled)) * 100));
    const perfScore = Math.round(conversionPercent * 0.6 + efficiencyPercent * 0.4);
    const isOnLeave = onLeave.has(m.userId);
    const att = attendanceMap.get(m.userId);
    return {
      id: m.user.id,
      name: m.user.name,
      phone: m.user.mobile ?? "",
      role: m.jobRole,
      roleLabel: roleLabel(m.jobRole),
      joiningDate: m.user.createdAt.toISOString(),
      status: isOnLeave ? "ON_LEAVE" : "ACTIVE",
      performanceScore: perfScore,
      performance: {
        leadsHandled,
        tasksCompleted,
        conversionPercent,
        efficiencyPercent,
      },
      attendanceToday: {
        checkIn: att?.checkIn?.toISOString() ?? null,
        checkOut: att?.checkOut?.toISOString() ?? null,
        present: Boolean(att?.checkIn),
      },
      pipActive: pipUsers.has(m.userId),
    };
  });

  if (filter === "active") employees = employees.filter((e) => e.status === "ACTIVE");
  if (filter === "on_leave") employees = employees.filter((e) => e.status === "ON_LEAVE");

  const sortedPerf = [...employees].sort((a, b) => b.performanceScore - a.performanceScore);
  const lowPerf = employees.filter((e) => e.performanceScore < 40).length;
  const present = employees.filter((e) => e.attendanceToday.present).length;

  const leaves = await (prisma as any).leaveRequest.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { id: true, name: true } } },
  });

  return jsonSuccess({
    employees,
    attendance: {
      present,
      absent: Math.max(0, employees.length - present),
      today: employees.map((e) => ({
        userId: e.id,
        name: e.name,
        status: e.attendanceToday.present ? "PRESENT" : "ABSENT",
        checkIn: e.attendanceToday.checkIn,
        checkOut: e.attendanceToday.checkOut,
      })),
    },
    leaves: {
      pending: leaves.filter((l: any) => l.status === "PENDING").length,
      approved: leaves.filter((l: any) => l.status === "APPROVED").length,
      requests: leaves.map((l: any) => ({
        id: l.id,
        userId: l.userId,
        userName: l.user?.name ?? "Team member",
        fromDate: l.fromDate.toISOString(),
        toDate: l.toDate.toISOString(),
        reason: l.reason,
        status: l.status,
      })),
    },
    performance: {
      topPerformerId: sortedPerf[0]?.id ?? null,
      lowPerformerIds: employees.filter((e) => e.performanceScore < 40).map((e) => e.id),
    },
    insights: {
      insightLines: [`${lowPerf} employees underperforming`, `${Math.max(0, employees.length - present)} absent today`],
      suggestionLines: ["Start training", "Reassign tasks"],
    },
  });
}
