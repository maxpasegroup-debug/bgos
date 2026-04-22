import { LeadStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTechRequestStatus, parseTechRequestDescription } from "@/lib/sde-tech-request-payload";

const ALLOWED_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.MANAGER]);
const ACTIVE_ONBOARDING_EXCLUDE = new Set<LeadStatus>([LeadStatus.NEW, LeadStatus.LOST, LeadStatus.WON]);

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function daysSince(d: Date): number {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

function stageFromLead(status: LeadStatus, internalStage: string | null): string {
  if (internalStage && internalStage.trim()) return internalStage;
  return status;
}

function teamName(name: string | null, email: string): string {
  if (name && name.trim()) return name.trim();
  const local = email.split("@")[0] ?? "Member";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!ALLOWED_ROLES.has(user.role as UserRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!user.companyId) {
    return NextResponse.json({ error: "No active company in session." }, { status: 400 });
  }

  const monthStart = startOfMonth();
  const todayStart = startOfToday();
  const companyId = user.companyId;

  const [leads, techRequests, bdmMemberships, sdeMemberships, activityLogs] = await Promise.all([
    prisma.lead.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        leadCompanyName: true,
        name: true,
        email: true,
        phone: true,
        source: true,
        status: true,
        createdAt: true,
        assignedTo: true,
        internalSalesStage: true,
      },
    }),
    prisma.techRequest.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        roleName: true,
        description: true,
        priority: true,
        status: true,
        requestedBy: true,
        createdAt: true,
      },
    }),
    prisma.userCompany.findMany({
      where: { companyId, jobRole: UserRole.BDM },
      select: { userId: true, user: { select: { name: true, email: true } } },
    }),
    prisma.userCompany.findMany({
      where: { companyId, jobRole: { in: [UserRole.TECH_EXECUTIVE, UserRole.TECH_HEAD] } },
      select: { userId: true, jobRole: true, user: { select: { name: true, email: true } } },
    }),
    prisma.activityLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        message: true,
        createdAt: true,
      },
    }),
  ]);

  const people = new Map<string, { name: string; email: string }>();
  for (const m of [...bdmMemberships, ...sdeMemberships]) {
    people.set(m.userId, { name: teamName(m.user.name, m.user.email), email: m.user.email });
  }

  const newSignupsLeads = leads.filter((lead) => (lead.source ?? "").toUpperCase() === "WEBSITE" && lead.status === LeadStatus.NEW);
  const newSignups = {
    count: newSignupsLeads.length,
    leads: newSignupsLeads.slice(0, 20).map((lead) => ({
      id: lead.id,
      leadCompanyName: lead.leadCompanyName || lead.name,
      email: lead.email,
      phone: lead.phone,
      createdAt: lead.createdAt.toISOString(),
      assignedTo: lead.assignedTo,
      bdmName: lead.assignedTo ? (people.get(lead.assignedTo)?.name ?? "Unassigned") : "Unassigned",
    })),
  };

  const activeOnboardingLeads = leads.filter((lead) => !ACTIVE_ONBOARDING_EXCLUDE.has(lead.status));
  const activeOnboardings = {
    count: activeOnboardingLeads.length,
    items: activeOnboardingLeads.slice(0, 30).map((lead) => ({
      id: lead.id,
      leadCompanyName: lead.leadCompanyName || lead.name,
      industry: null as string | null,
      bdmName: lead.assignedTo ? (people.get(lead.assignedTo)?.name ?? "Unassigned") : "Unassigned",
      stage: stageFromLead(lead.status, lead.internalSalesStage),
      daysActive: daysSince(lead.createdAt),
    })),
  };

  const parsedTech = techRequests.map((row) => {
    const desc = parseTechRequestDescription(row.description);
    return { row, desc, normalizedStatus: normalizeTechRequestStatus(row.status) };
  });

  const activeBuildRows = parsedTech.filter((item) => item.normalizedStatus !== "DONE");
  const activeBuilds = {
    count: activeBuildRows.length,
    items: activeBuildRows.slice(0, 30).map((item) => ({
      id: item.row.id,
      companyName: item.desc.companyName ?? "Unknown company",
      type: item.row.roleName,
      priority: (item.row.priority ?? "NORMAL").toUpperCase(),
      sdeName: item.desc.sdeAssigned ? (people.get(item.desc.sdeAssigned)?.name ?? "Unassigned") : "Unassigned",
      status: item.normalizedStatus,
      createdAt: item.row.createdAt.toISOString(),
    })),
  };

  const deliveredRows = parsedTech.filter((item) => {
    if (item.normalizedStatus !== "DONE") return false;
    if (!item.desc.completedAt) return false;
    const completed = new Date(item.desc.completedAt);
    if (Number.isNaN(completed.getTime())) return false;
    return completed >= monthStart;
  });

  const deliveredThisMonth = {
    count: deliveredRows.length,
    items: deliveredRows.slice(0, 30).map((item) => ({
      id: item.row.id,
      companyName: item.desc.companyName ?? "Unknown company",
      deliveredAt: item.desc.completedAt ?? item.row.createdAt.toISOString(),
      bdmName: item.row.requestedBy ? (people.get(item.row.requestedBy)?.name ?? "BDM") : "BDM",
    })),
  };

  const bdm = bdmMemberships.map((member) => {
    const leadsThisMonth = leads.filter((lead) => lead.assignedTo === member.userId && lead.createdAt >= monthStart).length;
    const onboardingsActive = activeOnboardingLeads.filter((lead) => lead.assignedTo === member.userId).length;
    const deliveredCount = deliveredRows.filter((row) => row.row.requestedBy === member.userId).length;
    return {
      userId: member.userId,
      name: teamName(member.user.name, member.user.email),
      email: member.user.email,
      leadsThisMonth,
      onboardingsActive,
      deliveredThisMonth: deliveredCount,
    };
  });

  const sde = sdeMemberships.map((member) => {
    const buildsForSde = parsedTech.filter((item) => item.desc.sdeAssigned === member.userId);
    const buildsActive = buildsForSde.filter((item) => item.normalizedStatus !== "DONE").length;
    const buildsCompletedThisMonth = buildsForSde.filter((item) => {
      if (item.normalizedStatus !== "DONE") return false;
      const doneAt = item.desc.completedAt ? new Date(item.desc.completedAt) : item.row.createdAt;
      return doneAt >= monthStart;
    }).length;
    const urgentPending = buildsForSde.filter((item) => item.normalizedStatus !== "DONE" && (item.row.priority ?? "").toUpperCase() === "URGENT").length;
    return {
      userId: member.userId,
      name: teamName(member.user.name, member.user.email),
      email: member.user.email,
      buildsActive,
      buildsCompletedThisMonth,
      urgentPending,
    };
  });

  const summary = {
    totalActiveClients: deliveredRows.length,
    newSignupsToday: newSignupsLeads.filter((lead) => lead.createdAt >= todayStart).length,
    buildsInProgress: activeBuildRows.length,
    deliveredThisMonth: deliveredRows.length,
  };

  const fallbackActivity = [
    ...newSignupsLeads.slice(0, 4).map((lead) => ({
      id: `lead-${lead.id}`,
      text: `New signup: ${lead.leadCompanyName || lead.name} assigned to ${lead.assignedTo ? (people.get(lead.assignedTo)?.name ?? "BDM") : "Unassigned"}`,
      createdAt: lead.createdAt.toISOString(),
    })),
    ...deliveredRows.slice(0, 4).map((row) => ({
      id: `done-${row.row.id}`,
      text: `SDE completed build: ${row.desc.companyName ?? "Unknown company"}`,
      createdAt: row.desc.completedAt ?? row.row.createdAt.toISOString(),
    })),
  ];
  const activityFeed = (activityLogs.length
    ? activityLogs.map((a) => ({
        id: a.id,
        text: a.message || a.type || "Activity update",
        createdAt: a.createdAt.toISOString(),
      }))
    : fallbackActivity
  ).slice(0, 10);

  return NextResponse.json({
    newSignups,
    activeOnboardings,
    activeBuilds,
    deliveredThisMonth,
    teamStats: { bdm, sde },
    summary,
    activityFeed,
  });
}
