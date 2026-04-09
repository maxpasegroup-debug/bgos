import { LeadStatus, TaskStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { parseDashboardRangeQuery } from "@/lib/dashboard-range";
import { leadStatusLabel } from "@/lib/lead-pipeline";
import { prisma } from "@/lib/prisma";
import { serializeLead } from "@/lib/lead-serialize";

type StageKey =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "SITE_VISIT"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

const STAGES: { key: StageKey; label: string; statuses: LeadStatus[] }[] = [
  { key: "NEW", label: "New Lead", statuses: [LeadStatus.NEW] },
  { key: "CONTACTED", label: "Contacted", statuses: [LeadStatus.CONTACTED] },
  { key: "QUALIFIED", label: "Qualified", statuses: [LeadStatus.QUALIFIED] },
  {
    key: "SITE_VISIT",
    label: "Site Visit",
    statuses: [LeadStatus.SITE_VISIT_SCHEDULED, LeadStatus.SITE_VISIT_COMPLETED],
  },
  { key: "PROPOSAL_SENT", label: "Proposal Sent", statuses: [LeadStatus.PROPOSAL_SENT] },
  {
    key: "NEGOTIATION",
    label: "Negotiation",
    statuses: [LeadStatus.NEGOTIATION, LeadStatus.PROPOSAL_WON],
  },
  { key: "WON", label: "Won", statuses: [LeadStatus.WON] },
  { key: "LOST", label: "Lost", statuses: [LeadStatus.LOST] },
];

function bucketForStatus(status: LeadStatus): StageKey {
  if (status === LeadStatus.NEW) return "NEW";
  if (status === LeadStatus.CONTACTED) return "CONTACTED";
  if (status === LeadStatus.QUALIFIED) return "QUALIFIED";
  if (status === LeadStatus.SITE_VISIT_SCHEDULED || status === LeadStatus.SITE_VISIT_COMPLETED) {
    return "SITE_VISIT";
  }
  if (status === LeadStatus.PROPOSAL_SENT) return "PROPOSAL_SENT";
  if (status === LeadStatus.NEGOTIATION || status === LeadStatus.PROPOSAL_WON) return "NEGOTIATION";
  if (status === LeadStatus.WON) return "WON";
  return "LOST";
}

function conversionPct(won: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((won / total) * 100);
}

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const range = parseDashboardRangeQuery(request.nextUrl.searchParams.get("range"));
  const companyId = session.companyId;

  const users = await prisma.userCompany.findMany({
    where: { companyId, user: { isActive: true } },
    select: {
      userId: true,
      jobRole: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const leads = await prisma.lead.findMany({
    where: {
      companyId,
      createdAt: { gte: range.start, lte: range.end },
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const wonLeads = leads.filter((l) => l.status === LeadStatus.WON);
  const metrics = {
    totalLeads: leads.length,
    dealsWon: wonLeads.length,
    conversionPercent: conversionPct(wonLeads.length, leads.length),
    revenueGenerated: wonLeads.reduce((sum, l) => sum + (l.value ?? 0), 0),
  };

  const byStage = new Map<StageKey, ReturnType<typeof serializeLead>[]>();
  for (const s of STAGES) byStage.set(s.key, []);
  for (const lead of leads) {
    const key = bucketForStatus(lead.status);
    byStage.get(key)?.push(serializeLead(lead));
  }

  const pipeline = STAGES.map((s) => {
    const cards = byStage.get(s.key) ?? [];
    return {
      key: s.key,
      label: s.label,
      statuses: s.statuses,
      count: cards.length,
      leads: cards,
    };
  });

  const revenueRows = await prisma.invoicePayment.findMany({
    where: {
      companyId,
      date: { gte: range.start, lte: range.end },
      invoice: { lead: { assignedTo: { not: null } } },
    },
    select: {
      amount: true,
      invoice: { select: { lead: { select: { assignedTo: true } } } },
    },
  });

  const byUser = new Map<string, { leadsHandled: number; dealsClosed: number; revenue: number }>();
  for (const u of users) {
    byUser.set(u.userId, { leadsHandled: 0, dealsClosed: 0, revenue: 0 });
  }
  for (const l of leads) {
    if (!l.assignedTo || !byUser.has(l.assignedTo)) continue;
    const row = byUser.get(l.assignedTo)!;
    row.leadsHandled += 1;
    if (l.status === LeadStatus.WON) row.dealsClosed += 1;
  }
  for (const p of revenueRows) {
    const uid = p.invoice.lead?.assignedTo;
    if (!uid || !byUser.has(uid)) continue;
    byUser.get(uid)!.revenue += p.amount;
  }

  const team = users
    .map((u) => {
      const s = byUser.get(u.userId) ?? { leadsHandled: 0, dealsClosed: 0, revenue: 0 };
      return {
        userId: u.userId,
        name: u.user.name,
        leadsHandled: s.leadsHandled,
        dealsClosed: s.dealsClosed,
        conversionPercent: conversionPct(s.dealsClosed, s.leadsHandled),
        revenue: Math.round(s.revenue * 100) / 100,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.dealsClosed - a.dealsClosed || b.leadsHandled - a.leadsHandled);

  const followUpsPending = await prisma.task.count({
    where: {
      companyId,
      leadId: { not: null },
      status: TaskStatus.PENDING,
    },
  });
  const stuckNegotiation = await prisma.lead.count({
    where: {
      companyId,
      status: { in: [LeadStatus.NEGOTIATION, LeadStatus.PROPOSAL_WON] },
      createdAt: { gte: range.start, lte: range.end },
    },
  });

  const insights = {
    followUpsPending,
    stuckNegotiation,
    insightLines: [
      `${followUpsPending} leads need follow-up`,
      `${stuckNegotiation} deals stuck in negotiation`,
    ],
    suggestionLines: ["Focus on high value leads", "Reassign weak performer"],
  };

  return jsonSuccess({
    range: {
      preset: range.preset,
      label: range.label,
      from: range.start.toISOString(),
      to: range.end.toISOString(),
    },
    metrics,
    pipeline,
    team,
    insights,
    employees: users.map((u) => ({ id: u.user.id, name: u.user.name })),
    currentUserId: session.sub,
  });
}
