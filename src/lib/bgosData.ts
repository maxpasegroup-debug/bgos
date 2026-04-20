import "server-only";

import {
  UserMissionStatus,
  BdeWithdrawRequestStatus,
  EmployeeDomain,
  EmployeeSystem,
  IceconnectEmployeeRole,
  LeadStatus,
  SalesHierarchySubscriptionStatus,
  TechTaskStatus,
} from "@prisma/client";
import { utcTodayDate } from "@/lib/bde-nexa-engine";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";

/** Boss analytics domain filter (maps to {@link EmployeeDomain}). */
export type BgosDataDomain = "bgos" | "solar";

export function toEmployeeDomain(domain: BgosDataDomain): EmployeeDomain {
  return domain === "bgos" ? EmployeeDomain.BGOS : EmployeeDomain.SOLAR;
}

/** ICECONNECT users scoped to a business domain (BGOS vs Solar). */
export function iceconnectUserFilter(domain: BgosDataDomain) {
  return {
    employeeSystem: EmployeeSystem.ICECONNECT,
    employeeDomain: toEmployeeDomain(domain),
  };
}

async function resolveInternalCompanyId(): Promise<string | null> {
  const org = await getOrCreateInternalSalesCompanyId();
  return "error" in org ? null : org.companyId;
}

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function utcMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function formatRelativeTime(at: Date, now = new Date()): string {
  const sec = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function formatAvgCompletion(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "—";
  const hours = ms / 3600000;
  if (hours < 72) return `${hours.toFixed(1)} hrs`;
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

// ─── PROMPT 1 — Global layer ────────────────────────────────────────────────

/** Sum of hierarchy earnings (INR) for ICECONNECT users in the domain, internal org only. */
export async function getTotalRevenue(domain: BgosDataDomain = "bgos"): Promise<number> {
  const companyId = await resolveInternalCompanyId();
  if (!companyId) return 0;
  const agg = await prisma.salesHierarchyEarning.aggregate({
    where: {
      companyId,
      user: iceconnectUserFilter(domain),
    },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

export async function getActiveSubscriptions(domain: BgosDataDomain = "bgos"): Promise<number> {
  const companyId = await resolveInternalCompanyId();
  if (!companyId) return 0;
  return prisma.salesHierarchySubscription.count({
    where: {
      companyId,
      status: SalesHierarchySubscriptionStatus.ACTIVE,
      owner: iceconnectUserFilter(domain),
    },
  });
}

export async function getTotalEmployees(domain: BgosDataDomain = "bgos"): Promise<number> {
  return prisma.user.count({
    where: iceconnectUserFilter(domain),
  });
}

export type PerformanceSummary = {
  month_key: string;
  total_revenue_rollups: number;
  total_sales_rollups: number;
  new_customers: number;
};

export async function getPerformanceSummary(
  domain: BgosDataDomain = "bgos",
): Promise<PerformanceSummary> {
  const companyId = await resolveInternalCompanyId();
  const month = utcMonthStart(new Date());
  if (!companyId) {
    return {
      month_key: month.toISOString().slice(0, 7),
      total_revenue_rollups: 0,
      total_sales_rollups: 0,
      new_customers: 0,
    };
  }
  const agg = await prisma.performanceMetric.aggregate({
    where: {
      companyId,
      month,
      user: iceconnectUserFilter(domain),
    },
    _sum: {
      totalRevenue: true,
      totalSales: true,
      newCustomers: true,
    },
  });
  return {
    month_key: month.toISOString().slice(0, 7),
    total_revenue_rollups: agg._sum.totalRevenue ?? 0,
    total_sales_rollups: agg._sum.totalSales ?? 0,
    new_customers: agg._sum.newCustomers ?? 0,
  };
}

export type BossActivityType = "lead" | "sale" | "onboard";

export type BossActivityItem = {
  id: string;
  type: BossActivityType;
  text: string;
  time: string;
  at: Date;
};

/** Latest 10 mixed events: new leads, sales (earnings), onboarding starts. */
export async function getRecentActivities(
  domain: BgosDataDomain = "bgos",
  limit = 10,
): Promise<BossActivityItem[]> {
  const companyId = await resolveInternalCompanyId();
  const uf = iceconnectUserFilter(domain);
  if (!companyId) return [];

  const [leads, sales, onboard] = await Promise.all([
    prisma.lead.findMany({
      where: { companyId, createdAt: { gte: new Date(Date.now() - 90 * 864e5) } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        leadCompanyName: true,
        createdAt: true,
      },
    }),
    prisma.salesHierarchyEarning.findMany({
      where: {
        companyId,
        user: uf,
        createdAt: { gte: new Date(Date.now() - 90 * 864e5) },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        amount: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.onboarding.findMany({
      where: {
        OR: [{ companyId }, { lead: { companyId } }],
        createdAt: { gte: new Date(Date.now() - 90 * 864e5) },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        createdAt: true,
        lead: { select: { name: true, leadCompanyName: true } },
      },
    }),
  ]);

  const merged: BossActivityItem[] = [];

  for (const l of leads) {
    const label = l.leadCompanyName?.trim() || l.name;
    merged.push({
      id: `lead-${l.id}`,
      type: "lead",
      text: `New lead: ${label}`,
      at: l.createdAt,
      time: formatRelativeTime(l.createdAt),
    });
  }
  for (const s of sales) {
    const rupees = Math.round(s.amount);
    merged.push({
      id: `sale-${s.id}`,
      type: "sale",
      text: `${s.user.name} — sale recorded ₹${rupees.toLocaleString("en-IN")}`,
      at: s.createdAt,
      time: formatRelativeTime(s.createdAt),
    });
  }
  for (const o of onboard) {
    const label = o.lead.leadCompanyName?.trim() || o.lead.name;
    merged.push({
      id: `onboard-${o.id}`,
      type: "onboard",
      text: `Onboarding started: ${label}`,
      at: o.createdAt,
      time: formatRelativeTime(o.createdAt),
    });
  }

  merged.sort((a, b) => b.at.getTime() - a.at.getTime());
  return merged.slice(0, limit);
}

// ─── PROMPT 2 — Employee aggregation ───────────────────────────────────────────

export type EmployeeStats = {
  total_rsm: number;
  total_bdm: number;
  total_bde: number;
  total_tech: number;
};

export async function getEmployeeStats(domain: BgosDataDomain = "bgos"): Promise<EmployeeStats> {
  const base = {
    ...iceconnectUserFilter(domain),
    iceconnectEmployeeRole: { not: null },
  };
  const [rsm, bdm, bde, tech] = await Promise.all([
    prisma.user.count({ where: { ...base, iceconnectEmployeeRole: IceconnectEmployeeRole.RSM } }),
    prisma.user.count({ where: { ...base, iceconnectEmployeeRole: IceconnectEmployeeRole.BDM } }),
    prisma.user.count({ where: { ...base, iceconnectEmployeeRole: IceconnectEmployeeRole.BDE } }),
    prisma.user.count({
      where: { ...base, iceconnectEmployeeRole: IceconnectEmployeeRole.TECH_EXEC },
    }),
  ]);
  return { total_rsm: rsm, total_bdm: bdm, total_bde: bde, total_tech: tech };
}

// ─── PROMPT 3 — Revenue stats ────────────────────────────────────────────────

export type RevenueStats = {
  today_revenue: number;
  monthly_revenue: number;
  total_revenue: number;
  /** (last 30d − prior 30d) / prior 30d, when prior &gt; 0 */
  revenue_30d_growth_pct: number | null;
  /** New hierarchy subscriptions started this calendar month (Iceconnect domain). */
  new_subscriptions_mtd: number;
};

export async function getRevenueStats(domain: BgosDataDomain = "bgos"): Promise<RevenueStats> {
  const companyId = await resolveInternalCompanyId();
  const now = new Date();
  const day0 = utcDayStart(now);
  const month0 = utcMonthStart(now);
  const d30 = new Date(now.getTime() - 30 * 864e5);
  const d60 = new Date(now.getTime() - 60 * 864e5);
  const uf = iceconnectUserFilter(domain);

  if (!companyId) {
    return {
      today_revenue: 0,
      monthly_revenue: 0,
      total_revenue: 0,
      revenue_30d_growth_pct: null,
      new_subscriptions_mtd: 0,
    };
  }

  const [today, month, total, r30, p30, newSubsMtd] = await Promise.all([
    prisma.salesHierarchyEarning.aggregate({
      where: { companyId, user: uf, createdAt: { gte: day0 } },
      _sum: { amount: true },
    }),
    prisma.salesHierarchyEarning.aggregate({
      where: { companyId, user: uf, createdAt: { gte: month0 } },
      _sum: { amount: true },
    }),
    prisma.salesHierarchyEarning.aggregate({
      where: { companyId, user: uf },
      _sum: { amount: true },
    }),
    prisma.salesHierarchyEarning.aggregate({
      where: { companyId, user: uf, createdAt: { gte: d30 } },
      _sum: { amount: true },
    }),
    prisma.salesHierarchyEarning.aggregate({
      where: { companyId, user: uf, createdAt: { gte: d60, lt: d30 } },
      _sum: { amount: true },
    }),
    prisma.salesHierarchySubscription.count({
      where: {
        companyId,
        owner: uf,
        startedAt: { gte: month0 },
      },
    }),
  ]);

  const last30 = r30._sum.amount ?? 0;
  const prev30 = p30._sum.amount ?? 0;
  const revenue_30d_growth_pct =
    prev30 > 0 ? ((last30 - prev30) / prev30) * 100 : last30 > 0 ? 100 : null;

  return {
    today_revenue: today._sum.amount ?? 0,
    monthly_revenue: month._sum.amount ?? 0,
    total_revenue: total._sum.amount ?? 0,
    revenue_30d_growth_pct,
    new_subscriptions_mtd: newSubsMtd,
  };
}

// ─── PROMPT 4 — Performance lists ────────────────────────────────────────────

export type PerformerRow = {
  userId: string;
  name: string;
  sales_count: number;
  points: number;
  active_subscriptions: number;
};

export async function getTopPerformers(
  domain: BgosDataDomain = "bgos",
  take = 5,
): Promise<PerformerRow[]> {
  const companyId = await resolveInternalCompanyId();
  if (!companyId) return [];
  const rows = await prisma.userCompany.findMany({
    where: {
      companyId,
      archivedAt: null,
      user: iceconnectUserFilter(domain),
    },
    orderBy: [{ totalPoints: "desc" }, { activeSubscriptionsCount: "desc" }],
    take,
    select: {
      userId: true,
      totalPoints: true,
      activeSubscriptionsCount: true,
      user: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    userId: r.userId,
    name: r.user.name,
    points: r.totalPoints,
    active_subscriptions: r.activeSubscriptionsCount,
    sales_count: r.activeSubscriptionsCount,
  }));
}

export async function getLowPerformers(
  domain: BgosDataDomain = "bgos",
  take = 5,
): Promise<PerformerRow[]> {
  const companyId = await resolveInternalCompanyId();
  if (!companyId) return [];
  const rows = await prisma.userCompany.findMany({
    where: {
      companyId,
      archivedAt: null,
      user: iceconnectUserFilter(domain),
    },
    orderBy: [{ totalPoints: "asc" }, { activeSubscriptionsCount: "asc" }],
    take,
    select: {
      userId: true,
      totalPoints: true,
      activeSubscriptionsCount: true,
      user: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    userId: r.userId,
    name: r.user.name,
    points: r.totalPoints,
    active_subscriptions: r.activeSubscriptionsCount,
    sales_count: r.activeSubscriptionsCount,
  }));
}

// ─── PROMPT 6 — Tech status ───────────────────────────────────────────────────

export type TechStats = {
  pending_tasks: number;
  completed_tasks: number;
  avg_time_ms: number | null;
  avg_time_label: string;
};

export async function getTechStats(): Promise<TechStats> {
  const companyId = await resolveInternalCompanyId();
  if (!companyId) {
    return { pending_tasks: 0, completed_tasks: 0, avg_time_ms: null, avg_time_label: "—" };
  }

  const [pending, completed, avgRow] = await Promise.all([
    prisma.internalTechTask.count({
      where: {
        companyId,
        status: { in: [TechTaskStatus.NEW, TechTaskStatus.IN_PROGRESS] },
      },
    }),
    prisma.internalTechTask.count({
      where: { companyId, status: TechTaskStatus.COMPLETED },
    }),
    prisma.internalTechTask.aggregate({
      where: { companyId, status: TechTaskStatus.COMPLETED, completionTimeMs: { not: null } },
      _avg: { completionTimeMs: true },
    }),
  ]);

  const avgMs = avgRow._avg.completionTimeMs ?? null;
  return {
    pending_tasks: pending,
    completed_tasks: completed,
    avg_time_ms: avgMs,
    avg_time_label: formatAvgCompletion(avgMs),
  };
}

// ─── Finance rollups (wallet + payouts) ─────────────────────────────────────

export type FinanceRollup = {
  total_payouts_mtd: number;
  pending_payouts: number;
  revenue_retained_pct: number | null;
};

export async function getFinanceRollup(domain: BgosDataDomain = "bgos"): Promise<FinanceRollup> {
  const companyId = await resolveInternalCompanyId();
  const month0 = utcMonthStart(new Date());
  const uf = iceconnectUserFilter(domain);
  if (!companyId) {
    return { total_payouts_mtd: 0, pending_payouts: 0, revenue_retained_pct: null };
  }

  const [paidMtd, pendingAgg, revenueMonth] = await Promise.all([
    prisma.salesHierarchyEarning.aggregate({
      where: {
        companyId,
        user: uf,
        paidAt: { gte: month0 },
      },
      _sum: { amount: true },
    }),
    prisma.internalWallet.aggregate({
      where: { user: uf },
      _sum: { pendingBalance: true },
    }),
    prisma.salesHierarchyEarning.aggregate({
      where: { companyId, user: uf, createdAt: { gte: month0 } },
      _sum: { amount: true },
    }),
  ]);

  const payouts = paidMtd._sum.amount ?? 0;
  const pending = pendingAgg._sum.pendingBalance ?? 0;
  const rev = revenueMonth._sum.amount ?? 0;
  const revenue_retained_pct =
    rev > 0 ? Math.max(0, Math.min(100, ((rev - payouts) / rev) * 100)) : null;

  return {
    total_payouts_mtd: payouts,
    pending_payouts: pending,
    revenue_retained_pct,
  };
}

/** Conversion: leads won ÷ leads touched in last 30 days (internal org). */
export async function getConversionSnapshot(domain: BgosDataDomain = "bgos"): Promise<{
  rate_pct: number;
  won_30d: number;
  pool_30d: number;
}> {
  const companyId = await resolveInternalCompanyId();
  const since = new Date(Date.now() - 30 * 864e5);
  if (!companyId) return { rate_pct: 0, won_30d: 0, pool_30d: 0 };

  const [won, created] = await Promise.all([
    prisma.lead.count({
      where: {
        companyId,
        status: LeadStatus.WON,
        updatedAt: { gte: since },
      },
    }),
    prisma.lead.count({
      where: { companyId, createdAt: { gte: since } },
    }),
  ]);
  const pool = Math.max(created, 1);
  return {
    won_30d: won,
    pool_30d: created,
    rate_pct: (won / pool) * 100,
  };
}

// ─── PROMPT 9 — Nexa intelligence ───────────────────────────────────────────

export type InsightAlert = { id: string; type: "warn" | "action" | "info"; text: string };

export type InsightsResult = {
  alerts: InsightAlert[];
  suggestions: string[];
};

export function generateInsights(input: {
  revenue: RevenueStats;
  employeeStats: EmployeeStats;
  topPerformers: PerformerRow[];
  lowPerformers: PerformerRow[];
  conversion: { rate_pct: number; won_30d: number; pool_30d: number };
}): InsightsResult {
  const alerts: InsightAlert[] = [];
  const suggestions: string[] = [];
  let id = 0;
  const nextId = () => `ins-${++id}`;

  const { revenue, employeeStats, topPerformers, lowPerformers, conversion } = input;

  if (revenue.revenue_30d_growth_pct != null) {
    if (revenue.revenue_30d_growth_pct < -10) {
      alerts.push({
        id: nextId(),
        type: "warn",
        text: `Revenue velocity is down about ${Math.abs(Math.round(revenue.revenue_30d_growth_pct))}% vs the prior 30 days — review pipeline and coaching.`,
      });
    } else if (revenue.revenue_30d_growth_pct > 8) {
      alerts.push({
        id: nextId(),
        type: "info",
        text: `Strong stretch: revenue from Iceconnect BGOS sales is up about ${Math.round(revenue.revenue_30d_growth_pct)}% rolling 30 days.`,
      });
    }
  }

  const lowPoints = lowPerformers.filter((p) => p.points < 300);
  if (lowPoints.length >= 2) {
    alerts.push({
      id: nextId(),
      type: "warn",
      text: `${lowPoints.length} Iceconnect BGOS team members are light on points — schedule a coaching block.`,
    });
  }

  if (conversion.won_30d === 0 && conversion.pool_30d > 5) {
    alerts.push({
      id: nextId(),
      type: "action",
      text: `${conversion.pool_30d} new leads in 30 days with no closed-won yet — tighten follow-up SLAs.`,
    });
  }

  if (revenue.monthly_revenue > 0 && revenue.revenue_30d_growth_pct != null && revenue.revenue_30d_growth_pct >= -3) {
    suggestions.push("You are close to prior-period revenue pace — a focused push this week can clear the gap.");
  }

  if (topPerformers.length > 0) {
    suggestions.push(
      `Top desk: ${topPerformers[0]?.name ?? "Team"} — replicate their cadence across ${employeeStats.total_bde} BDEs.`,
    );
  }

  if (alerts.length === 0 && suggestions.length === 0) {
    alerts.push({
      id: nextId(),
      type: "info",
      text: "Nexa: systems look stable — keep monitoring weekly revenue and tech queue depth.",
    });
  }

  return { alerts: alerts.slice(0, 6), suggestions: suggestions.slice(0, 4) };
}

/** Nexa field pipeline: BDE prospects + daily mission wins (super-boss visibility). */
/** BDE wallet + payouts for super-boss financial visibility. */
export async function getBdeWalletBossSnapshot(domain: BgosDataDomain = "bgos") {
  const filter = iceconnectUserFilter(domain);
  const bdeWhere = { ...filter, iceconnectEmployeeRole: IceconnectEmployeeRole.BDE };

  const [paidAgg, pendingAgg, pendingCount, topWallets] = await Promise.all([
    prisma.bdeWithdrawRequest.aggregate({
      where: { status: BdeWithdrawRequestStatus.PAID, user: bdeWhere },
      _sum: { amount: true },
    }),
    prisma.bdeWithdrawRequest.aggregate({
      where: { status: BdeWithdrawRequestStatus.PENDING, user: bdeWhere },
      _sum: { amount: true },
    }),
    prisma.bdeWithdrawRequest.count({
      where: { status: BdeWithdrawRequestStatus.PENDING, user: bdeWhere },
    }),
    prisma.bdeWallet.findMany({
      where: { user: bdeWhere },
      orderBy: { totalEarned: "desc" },
      take: 8,
      select: {
        userId: true,
        totalEarned: true,
        withdrawableAmount: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  return {
    total_payouts_inr: paidAgg._sum.amount ?? 0,
    pending_withdrawals_inr: pendingAgg._sum.amount ?? 0,
    pending_request_count: pendingCount,
    top_earners: topWallets.map((w) => ({
      user_id: w.userId,
      name: w.user.name,
      email: w.user.email,
      total_earned: w.totalEarned,
      withdrawable_inr: w.withdrawableAmount,
    })),
  };
}

export async function getBdeNexaFieldSnapshot(domain: BgosDataDomain = "bgos") {
  const filter = iceconnectUserFilter(domain);
  const bdeWhere = { ...filter, iceconnectEmployeeRole: IceconnectEmployeeRole.BDE };
  const today = utcTodayDate();

  const [totalProspects, prospectsToday, missionsCompletedToday, topGroups] = await Promise.all([
    prisma.bdeProspect.count({ where: { user: bdeWhere } }),
    prisma.bdeProspect.count({
      where: {
        user: bdeWhere,
        createdAt: { gte: utcDayStart(new Date()) },
      },
    }),
    prisma.userMission.count({
      where: {
        user: bdeWhere,
        status: UserMissionStatus.COMPLETED,
        missionDate: today,
      },
    }),
    prisma.bdeProspect.groupBy({
      by: ["userId"],
      where: { user: bdeWhere },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);

  const userIds = topGroups.map((g) => g.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return {
    total_prospects: totalProspects,
    prospects_today: prospectsToday,
    missions_completed_today: missionsCompletedToday,
    top_performers: topGroups.map((g) => ({
      user_id: g.userId,
      name: nameById.get(g.userId) ?? "BDE",
      prospects: g._count.id,
    })),
  };
}

export function formatInr(amount: number): string {
  if (!Number.isFinite(amount)) return "₹0";
  const rounded = Math.round(amount);
  if (rounded >= 100000) {
    const lakhs = rounded / 100000;
    return `₹${lakhs.toFixed(1)}L`;
  }
  return `₹${rounded.toLocaleString("en-IN")}`;
}
