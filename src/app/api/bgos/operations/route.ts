import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type WorkflowStage =
  | "SITE_VISIT_SCHEDULED"
  | "SITE_VISIT_COMPLETED"
  | "APPROVAL"
  | "INSTALLATION_SCHEDULED"
  | "INSTALLATION_IN_PROGRESS"
  | "COMPLETED";

type WorkflowCard = {
  id: string;
  stage: WorkflowStage;
  source: "site_visit" | "approval" | "installation";
  sourceId: string;
  customerName: string;
  location: string;
  assignedToUserId: string | null;
  assignedEmployee: string;
  status: string;
  leadId: string | null;
  scheduledDate: string | null;
  notes: string | null;
};

function workflowOrder(): WorkflowStage[] {
  return [
    "SITE_VISIT_SCHEDULED",
    "SITE_VISIT_COMPLETED",
    "APPROVAL",
    "INSTALLATION_SCHEDULED",
    "INSTALLATION_IN_PROGRESS",
    "COMPLETED",
  ];
}

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const q = request.nextUrl.searchParams.get("range")?.trim() ?? "today";
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const weekStart = new Date(startOfDay);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = endOfDay;
  const range =
    q === "this_week"
      ? { preset: "this_week", label: "This Week", start: weekStart, end: weekEnd }
      : q === "this_month"
        ? { preset: "this_month", label: "This Month", start: monthStart, end: monthEnd }
        : { preset: "today", label: "Today", start: startOfDay, end: endOfDay };
  const companyId = session.companyId;

  const [leads, users, siteVisits, approvals, installations, serviceTickets] = await Promise.all([
    prisma.lead.findMany({
      where: { companyId, createdAt: { gte: range.start, lte: range.end } },
      select: {
        id: true,
        name: true,
        source: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.userCompany.findMany({
      where: { companyId, user: { isActive: true } },
      select: { userId: true, user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    (prisma as any).siteVisit.findMany({
      where: { companyId },
      include: {
        lead: { select: { id: true, name: true, source: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    (prisma as any).approval.findMany({
      where: { companyId },
      include: { lead: { select: { id: true, name: true, source: true } } },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    (prisma as any).installation.findMany({
      where: { companyId },
      include: {
        lead: { select: { id: true, name: true, source: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    (prisma as any).serviceTicket.findMany({
      where: { companyId },
      include: {
        lead: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
  ]);

  const cards: WorkflowCard[] = [];
  for (const sv of siteVisits as any[]) {
    cards.push({
      id: `site_${sv.id}`,
      stage: sv.status === "COMPLETED" ? "SITE_VISIT_COMPLETED" : "SITE_VISIT_SCHEDULED",
      source: "site_visit",
      sourceId: sv.id,
      customerName: sv.lead?.name ?? "Customer",
      location: sv.lead?.source?.trim() || "—",
      assignedToUserId: sv.assignedTo ?? null,
      assignedEmployee: sv.assignee?.name ?? "Unassigned",
      status: sv.status,
      leadId: sv.leadId ?? null,
      scheduledDate: sv.report?.date ? String(sv.report.date) : null,
      notes: null,
    });
  }
  for (const ap of approvals as any[]) {
    cards.push({
      id: `approval_${ap.id}`,
      stage: "APPROVAL",
      source: "approval",
      sourceId: ap.id,
      customerName: ap.lead?.name ?? "Customer",
      location: ap.lead?.source?.trim() || "—",
      assignedToUserId: null,
      assignedEmployee: "Operations",
      status: ap.status,
      leadId: ap.leadId ?? null,
      scheduledDate: null,
      notes: ap.notes ?? null,
    });
  }
  for (const inst of installations as any[]) {
    const stage: WorkflowStage =
      inst.status === "COMPLETED"
        ? "COMPLETED"
        : inst.status === "IN_PROGRESS"
          ? "INSTALLATION_IN_PROGRESS"
          : "INSTALLATION_SCHEDULED";
    cards.push({
      id: `install_${inst.id}`,
      stage,
      source: "installation",
      sourceId: inst.id,
      customerName: inst.lead?.name ?? "Customer",
      location: inst.lead?.source?.trim() || "—",
      assignedToUserId: inst.assignedTo ?? null,
      assignedEmployee: inst.assignee?.name ?? "Unassigned",
      status: inst.status,
      leadId: inst.leadId ?? null,
      scheduledDate: inst.scheduledDate ? new Date(inst.scheduledDate).toISOString() : null,
      notes: inst.notes ?? null,
    });
  }

  const stageOrder = workflowOrder();
  const workflow = stageOrder.map((stage) => {
    const rows = cards.filter((c) => c.stage === stage);
    return { stage, count: rows.length, cards: rows };
  });

  const pendingSiteVisits = cards.filter((c) => c.stage === "SITE_VISIT_SCHEDULED").length;
  const pendingApprovals = cards.filter((c) => c.stage === "APPROVAL" && c.status === "PENDING").length;
  const installationsInProgress = cards.filter((c) => c.stage === "INSTALLATION_IN_PROGRESS").length;
  const completedJobs = cards.filter((c) => c.stage === "COMPLETED").length;

  const teamBase = new Map<string, { name: string; jobsAssigned: number; jobsCompleted: number; delays: number }>();
  for (const u of users) {
    teamBase.set(u.userId, { name: u.user.name, jobsAssigned: 0, jobsCompleted: 0, delays: 0 });
  }
  for (const c of cards) {
    const uid = c.assignedToUserId;
    if (!uid || !teamBase.has(uid)) continue;
    const row = teamBase.get(uid)!;
    row.jobsAssigned += 1;
    if (c.stage === "COMPLETED") row.jobsCompleted += 1;
  }
  const nowMs = Date.now();
  for (const c of cards) {
    const uid = c.assignedToUserId;
    if (!uid || !teamBase.has(uid)) continue;
    const due = c.scheduledDate ? Date.parse(c.scheduledDate) : null;
    if (due && !Number.isNaN(due) && due < nowMs && c.stage !== "COMPLETED") {
      teamBase.get(uid)!.delays += 1;
    }
  }
  const team = [...teamBase.entries()]
    .map(([userId, t]) => ({ userId, ...t }))
    .sort((a, b) => b.jobsCompleted - a.jobsCompleted || a.delays - b.delays || b.jobsAssigned - a.jobsAssigned);

  const delayedInstalls = cards.filter(
    (c) =>
      c.stage === "INSTALLATION_IN_PROGRESS" &&
      c.scheduledDate &&
      Date.parse(c.scheduledDate) < Date.now(),
  ).length;
  const insightLines = [`${delayedInstalls} installations delayed`, `${pendingApprovals} approvals pending`];

  return jsonSuccess({
    range: {
      preset: range.preset,
      label: range.label,
      from: range.start.toISOString(),
      to: range.end.toISOString(),
    },
    metrics: {
      pendingSiteVisits,
      pendingApprovals,
      installationsInProgress,
      completedJobs,
    },
    workflow,
    team,
    insights: {
      insightLines,
      suggestionLines: ["Assign extra technician", "Follow up approvals"],
    },
    serviceTickets: (serviceTickets as any[]).map((s) => {
      const raw = (s.description as string | null) ?? "";
      let uiStatus: "OPEN" | "IN_PROGRESS" | "CLOSED" = s.status === "RESOLVED" ? "CLOSED" : "OPEN";
      if (uiStatus === "OPEN" && raw.startsWith("[IN_PROGRESS]")) uiStatus = "IN_PROGRESS";
      return {
        id: s.id,
        customer: s.lead?.name ?? "Customer",
        leadId: s.leadId ?? null,
        issue: s.issue ?? s.title ?? "Service request",
        priority: raw.includes("[PRIORITY:HIGH]")
          ? "HIGH"
          : raw.includes("[PRIORITY:LOW]")
            ? "LOW"
            : "MEDIUM",
        status: uiStatus,
        assignedToUserId: s.assignedTo ?? null,
        assignedEmployee: s.assignee?.name ?? "Unassigned",
      };
    }),
    employees: users.map((u) => ({ id: u.user.id, name: u.user.name })),
    leads: leads.map((l) => ({ id: l.id, name: l.name, location: l.source ?? "—" })),
  });
}
