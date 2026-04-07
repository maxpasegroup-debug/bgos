import "server-only";

import { LeadStatus, ServiceTicketStatus, TaskStatus } from "@prisma/client";
import { calculateRevenue } from "@/lib/financial-metrics";
import { prisma } from "@/lib/prisma";

const OPPORTUNITY_STATUSES: LeadStatus[] = [
  LeadStatus.QUALIFIED,
  LeadStatus.PROPOSAL_SENT,
  LeadStatus.NEGOTIATION,
  LeadStatus.PROPOSAL_WON,
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
    pendingSiteVisits: number;
    pendingApprovals: number;
    installationsInProgress: number;
  };
  revenue: {
    monthlyWon: number;
    pipelineValue: number;
    expectedClosures: number;
    pendingAmount: number;
    unpaidInvoiceCount: number;
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
  hr: {
    totalEmployees: number;
    leavesPending: number;
    attendancePercent: number;
  };
  inventory: {
    products: number;
    lowStockItems: number;
    totalUnits: number;
  };
  partner: {
    totalPartnerLeads: number;
    totalCommissionPayable: number;
  };
  team: BgosTeamMemberStats[];
};

export async function buildBgosDashboardSnapshot(companyId: string): Promise<BgosDashboardSnapshot> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const openLeadWhere = {
    companyId,
    status: { notIn: CLOSED },
  };

  const invoiceRevenue = await calculateRevenue(companyId);

  const [
    pendingFollowUps,
    overdueFollowUps,
    delayedInstallations,
    opportunityLeads,
    installationQueue,
    openServiceTickets,
    lostLeads,
    pipelineValueAgg,
    expectedClosures,
    wonLeads,
    closedLost,
    tasksPending,
    tasksCompleted,
    companyMemberships,
    assignedLeadGroups,
    wonLeadGroups,
    pendingTaskGroups,
    totalEmployees,
    leavesPending,
    todayAttendanceCount,
    inventoryProducts,
    inventoryStockRows,
    partnerLeads,
    payableCommissions,
    pendingSiteVisits,
    pendingApprovals,
    installationsInProgress,
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
    prisma.lead.count({ where: { companyId, status: LeadStatus.LOST } }),
    prisma.lead.aggregate({
      _sum: { value: true },
      where: openLeadWhere,
    }),
    prisma.lead.count({
      where: {
        companyId,
        status: {
          in: [LeadStatus.PROPOSAL_SENT, LeadStatus.NEGOTIATION, LeadStatus.PROPOSAL_WON],
        },
      },
    }),
    prisma.lead.count({ where: { companyId, status: LeadStatus.WON } }),
    prisma.lead.count({ where: { companyId, status: LeadStatus.LOST } }),
    prisma.task.count({
      where: { status: TaskStatus.PENDING, companyId },
    }),
    prisma.task.count({
      where: { status: TaskStatus.COMPLETED, companyId },
    }),
    prisma.userCompany.findMany({
      where: { companyId, user: { isActive: true } },
      select: {
        jobRole: true,
        user: { select: { id: true, name: true, email: true } },
      },
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
    prisma.userCompany.count({
      where: { companyId, user: { isActive: true } },
    }),
    (prisma as any).leaveRequest.count({
      where: { companyId, status: "PENDING" },
    }),
    (prisma as any).attendance.findMany({
      where: { companyId, date: todayStart, checkIn: { not: null } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    (prisma as any).product.count({ where: { companyId } }),
    (prisma as any).stock.findMany({
      where: { companyId },
      select: { quantity: true },
    }),
    (prisma as any).lead.count({
      where: { companyId, partnerId: { not: null } },
    }),
    (prisma as any).commission.aggregate({
      where: { companyId, status: "PENDING" },
      _sum: { amount: true },
    }),
    (prisma as any).siteVisit.count({
      where: { companyId, status: "SCHEDULED" },
    }),
    (prisma as any).approval.count({
      where: { companyId, status: "PENDING" },
    }),
    (prisma as any).installation.count({
      where: { companyId, status: "IN_PROGRESS" },
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

  const teamRows = [...companyMemberships].sort((a, b) =>
    a.user.name.localeCompare(b.user.name),
  );
  const team: BgosTeamMemberStats[] = teamRows.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.jobRole,
    assignedLeads: assignedMap.get(m.user.id) ?? 0,
    wonLeads: wonMap.get(m.user.id) ?? 0,
    pendingTasks: taskMap.get(m.user.id) ?? 0,
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
      pendingPayments: invoiceRevenue.unpaidInvoiceCount,
      pendingSiteVisits,
      pendingApprovals,
      installationsInProgress,
    },
    revenue: {
      monthlyWon: invoiceRevenue.monthlyRevenue,
      pipelineValue: pipelineValueAgg._sum.value ?? 0,
      expectedClosures,
      pendingAmount: invoiceRevenue.pendingPayments,
      unpaidInvoiceCount: invoiceRevenue.unpaidInvoiceCount,
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
    hr: {
      totalEmployees,
      leavesPending,
      attendancePercent:
        totalEmployees > 0
          ? Math.round((100 * todayAttendanceCount.length) / totalEmployees)
          : 0,
    },
    inventory: {
      products: inventoryProducts,
      lowStockItems: inventoryStockRows.filter((r: any) => Number(r.quantity) <= 5).length,
      totalUnits: Math.round(
        inventoryStockRows.reduce((sum: number, r: any) => sum + Number(r.quantity || 0), 0),
      ),
    },
    partner: {
      totalPartnerLeads: partnerLeads,
      totalCommissionPayable: Number(payableCommissions?._sum?.amount ?? 0),
    },
    team,
  };
}
