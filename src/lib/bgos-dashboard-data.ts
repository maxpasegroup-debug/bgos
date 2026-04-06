import "server-only";

import {
  DealStatus,
  LeadStatus,
  PaymentStatus,
  ServiceTicketStatus,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const OPPORTUNITY_STATUSES: LeadStatus[] = [
  LeadStatus.QUALIFIED,
  LeadStatus.PROPOSAL_SENT,
  LeadStatus.NEGOTIATION,
];

const CLOSED: LeadStatus[] = [LeadStatus.WON, LeadStatus.LOST];

function startOfLocalMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export type BgosTeamMemberStats = {
  userId: string;
  name: string;
  email: string;
  role: string;
  assignedLeads: number;
  wonLeads: number;
  pendingTasks: number;
};

export type BgosDashboardSnapshot = {
  nexa: {
    pendingFollowUps: number;
    overdueFollowUps: number;
    delays: number;
    opportunities: number;
  };
  operations: {
    installationQueue: number;
    openServiceTickets: number;
    pendingPayments: number;
  };
  revenue: {
    monthlyWon: number;
    pipelineValue: number;
    expectedClosures: number;
    pendingAmount: number;
  };
  risks: {
    lostLeads: number;
    delays: number;
    openServiceTickets: number;
  };
  health: {
    efficiency: number;
    conversion: number;
    teamProductivity: number;
  };
  team: BgosTeamMemberStats[];
};

export async function buildBgosDashboardSnapshot(companyId: string): Promise<BgosDashboardSnapshot> {
  const now = new Date();
  const monthStart = startOfLocalMonth(now);

  const openLeadWhere = {
    companyId,
    status: { notIn: CLOSED },
  };

  const [
    pendingFollowUps,
    overdueFollowUps,
    delayedInstallations,
    opportunityLeads,
    installationQueue,
    openServiceTickets,
    pendingPaymentCount,
    lostLeads,
    monthlyWonAgg,
    pipelineValueAgg,
    expectedClosures,
    pendingAmountAgg,
    wonLeads,
    closedLost,
    tasksPending,
    tasksCompleted,
    users,
    assignedLeadGroups,
    wonLeadGroups,
    pendingTaskGroups,
  ] = await Promise.all([
    prisma.task.count({
      where: { status: TaskStatus.PENDING, companyId },
    }),
    prisma.task.count({
      where: {
        status: TaskStatus.PENDING,
        dueDate: { lt: now },
        companyId,
      },
    }),
    prisma.installation.count({
      where: {
        companyId,
        completedAt: null,
        scheduledDate: { lt: now },
      },
    }),
    prisma.lead.count({
      where: { companyId, status: { in: OPPORTUNITY_STATUSES } },
    }),
    prisma.installation.count({
      where: { companyId, completedAt: null },
    }),
    prisma.serviceTicket.count({
      where: { companyId, status: ServiceTicketStatus.OPEN },
    }),
    prisma.payment.count({
      where: { companyId, status: PaymentStatus.PENDING },
    }),
    prisma.lead.count({ where: { companyId, status: LeadStatus.LOST } }),
    prisma.deal.aggregate({
      _sum: { value: true },
      where: {
        status: DealStatus.WON,
        createdAt: { gte: monthStart },
        lead: { companyId },
      },
    }),
    prisma.lead.aggregate({
      _sum: { value: true },
      where: openLeadWhere,
    }),
    prisma.lead.count({
      where: {
        companyId,
        status: { in: [LeadStatus.PROPOSAL_SENT, LeadStatus.NEGOTIATION] },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { companyId, status: PaymentStatus.PENDING },
    }),
    prisma.lead.count({ where: { companyId, status: LeadStatus.WON } }),
    prisma.lead.count({ where: { companyId, status: LeadStatus.LOST } }),
    prisma.task.count({
      where: { status: TaskStatus.PENDING, companyId },
    }),
    prisma.task.count({
      where: { status: TaskStatus.COMPLETED, companyId },
    }),
    prisma.user.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: { companyId, assignedTo: { not: null } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: {
        companyId,
        status: LeadStatus.WON,
        assignedTo: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["userId"],
      where: {
        status: TaskStatus.PENDING,
        userId: { not: null },
        companyId,
      },
      _count: { _all: true },
    }),
  ]);

  const assignedMap = new Map<string, number>();
  for (const row of assignedLeadGroups) {
    if (row.assignedTo) assignedMap.set(row.assignedTo, row._count._all);
  }
  const wonMap = new Map<string, number>();
  for (const row of wonLeadGroups) {
    if (row.assignedTo) wonMap.set(row.assignedTo, row._count._all);
  }
  const taskMap = new Map<string, number>();
  for (const row of pendingTaskGroups) {
    if (row.userId) taskMap.set(row.userId, row._count._all);
  }

  const team: BgosTeamMemberStats[] = users.map((u) => ({
    userId: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    assignedLeads: assignedMap.get(u.id) ?? 0,
    wonLeads: wonMap.get(u.id) ?? 0,
    pendingTasks: taskMap.get(u.id) ?? 0,
  }));

  const closed = wonLeads + closedLost;
  const conversion =
    closed > 0 ? Math.round((100 * wonLeads) / closed) : 0;

  const taskTotal = tasksPending + tasksCompleted;
  const teamProductivity =
    taskTotal > 0 ? Math.round((100 * tasksCompleted) / taskTotal) : 100;

  const efficiency =
    pendingFollowUps > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(100 * (1 - overdueFollowUps / pendingFollowUps)),
          ),
        )
      : 100;

  return {
    nexa: {
      pendingFollowUps,
      overdueFollowUps,
      delays: delayedInstallations,
      opportunities: opportunityLeads,
    },
    operations: {
      installationQueue,
      openServiceTickets,
      pendingPayments: pendingPaymentCount,
    },
    revenue: {
      monthlyWon: monthlyWonAgg._sum.value ?? 0,
      pipelineValue: pipelineValueAgg._sum.value ?? 0,
      expectedClosures,
      pendingAmount: pendingAmountAgg._sum.amount ?? 0,
    },
    risks: {
      lostLeads,
      delays: delayedInstallations,
      openServiceTickets,
    },
    health: {
      efficiency,
      conversion,
      teamProductivity,
    },
    team,
  };
}
