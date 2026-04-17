import { DealStatus, IceconnectCustomerPlan, IceconnectMetroStage, LeadStatus, TaskStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { eligibleSalaryRupees, currentPeriod, monthBoundsUTC } from "@/lib/iceconnect-sales-hub";

type RouteContext = { params: Promise<{ id: string }> };

function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toMonthKey(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, "0")}`;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const employeeId = id.trim();
  if (!employeeId) {
    return NextResponse.json({ ok: false as const, error: "Missing employee id" }, { status: 400 });
  }

  const org = await getOrCreateInternalSalesCompanyId();
  if ("error" in org) {
    return NextResponse.json(
      { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
      { status: 500 },
    );
  }
  const companyId = org.companyId;

  const [userRow, targetRow, leadsHandled, tasksCompleted, tasksTotal] = await Promise.all([
    prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: employeeId, companyId } },
      select: {
        userId: true,
        jobRole: true,
        status: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            createdAt: true,
            isActive: true,
          },
        },
      } as any,
    }),
    prisma.salesExecutiveMonthlyTarget.findFirst({
      where: (() => {
        const p = currentPeriod();
        return { companyId, userId: employeeId, periodYear: p.year, periodMonth: p.month };
      })(),
    }),
    prisma.lead.count({ where: { companyId, assignedTo: employeeId } }),
    prisma.task.count({ where: { companyId, userId: employeeId, status: TaskStatus.COMPLETED } }),
    prisma.task.count({ where: { companyId, userId: employeeId } }),
  ]);

  if (!userRow) return NextResponse.json({ ok: false as const, error: "Employee not found" }, { status: 404 });

  const now = new Date();
  const period = currentPeriod();
  const { start: monthStart, end: monthEnd } = monthBoundsUTC(period.year, period.month);

  const dealsClosedThisMonthPromise = prisma.deal.count({
    where: { companyId, status: DealStatus.WON, lead: { assignedTo: employeeId }, createdAt: { gte: monthStart, lte: monthEnd } },
  });

  const revenueGeneratedThisMonthPromise = prisma.deal.aggregate({
    where: { companyId, status: DealStatus.WON, lead: { assignedTo: employeeId }, createdAt: { gte: monthStart, lte: monthEnd } },
    _sum: { value: true },
  });

  const leadsConvertedPromise = prisma.lead.count({
    where: { companyId, assignedTo: employeeId, status: LeadStatus.WON },
  });

  const pendingTasksPromise = prisma.task.count({
    where: { companyId, userId: employeeId, status: TaskStatus.PENDING },
  });

  const [dealsClosedThisMonth, leadsConverted, pendingTasks, revenueGeneratedThisMonthAgg] = await Promise.all([
    dealsClosedThisMonthPromise,
    leadsConvertedPromise,
    pendingTasksPromise,
    revenueGeneratedThisMonthPromise,
  ]);

  const achievedConversions = await (async () => {
    if (!targetRow) {
      return prisma.lead.count({
        where: {
          companyId,
          assignedTo: employeeId,
          iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
          iceconnectSubscribedAt: { gte: monthStart, lte: monthEnd },
        },
      });
    }
    return prisma.lead.count({
      where: {
        companyId,
        assignedTo: employeeId,
        iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
        iceconnectCustomerPlan: targetRow.targetPlan,
        iceconnectSubscribedAt: { gte: monthStart, lte: monthEnd },
      },
    });
  })();

  const baseSalaryRupees = targetRow?.salaryRupees ?? 0;
  const targetCount = targetRow?.targetCount ?? 0;
  const targetPlan = (targetRow?.targetPlan ?? null) as IceconnectCustomerPlan | null;

  const { eligible: eligibleSalaryRupeesValue, progressPct } = eligibleSalaryRupees(
    achievedConversions,
    targetCount,
    baseSalaryRupees,
  );

  // Incentives / promotion + KYC fields are new columns; read via raw SQL.
  const cfgRows = await prisma.$queryRawUnsafe<
    Array<{
      department: string | null;
      kycStatus: string;
      kycBankDetails: string | null;
      kycPan: string | null;
      kycPanDocumentId: string | null;
      kycIdDocumentId: string | null;
      incentivesEnabled: boolean;
      bonusDealsThreshold: number;
      bonusDealsAmount: number;
      incentivesValidUntil: Date | null;
      promotionEnabled: boolean;
      promotionValidUntil: Date | null;
      promotionPerformanceThreshold: number;
    }>
  >(
    `SELECT
      "department",
      "kycStatus",
      "kycBankDetails",
      "kycPan",
      "kycPanDocumentId",
      "kycIdDocumentId",
      "incentivesEnabled",
      "bonusDealsThreshold",
      "bonusDealsAmount",
      "incentivesValidUntil",
      "promotionEnabled",
      "promotionValidUntil",
      "promotionPerformanceThreshold"
    FROM "UserCompany"
    WHERE "companyId" = ? AND "userId" = ?`,
    companyId,
    employeeId,
  );

  const cfg = cfgRows?.[0] ?? {
    department: null,
    kycStatus: "PENDING",
    kycBankDetails: null,
    kycPan: null,
    kycPanDocumentId: null,
    kycIdDocumentId: null,
    incentivesEnabled: false,
    bonusDealsThreshold: 0,
    bonusDealsAmount: 0,
    incentivesValidUntil: null,
    promotionEnabled: false,
    promotionValidUntil: null,
    promotionPerformanceThreshold: 80,
  };

  const incentivesValid =
    cfg.incentivesEnabled &&
    (!cfg.incentivesValidUntil || new Date(cfg.incentivesValidUntil).getTime() >= now.getTime());

  const bonusPreview =
    incentivesValid && cfg.bonusDealsThreshold > 0 && dealsClosedThisMonth >= cfg.bonusDealsThreshold
      ? Number(cfg.bonusDealsAmount ?? 0)
      : 0;

  const employeeUser = (userRow as any).user as {
    id: string;
    name: string;
    email: string;
    mobile: string | null;
    createdAt: Date;
    isActive: boolean;
  };

  // Performance graphs (last 30 days)
  const start30 = new Date(now);
  start30.setDate(start30.getDate() - 29);

  const [leadCreatedRows, tasksCompletedRows, subscriptionsRows] = await Promise.all([
    prisma.lead.findMany({
      where: { companyId, assignedTo: employeeId, createdAt: { gte: start30, lte: now } },
      select: { createdAt: true },
    }),
    prisma.task.findMany({
      where: { companyId, userId: employeeId, status: TaskStatus.COMPLETED, createdAt: { gte: start30, lte: now } },
      select: { createdAt: true },
    }),
    prisma.lead.findMany({
      where: {
        companyId,
        assignedTo: employeeId,
        iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
        iceconnectSubscribedAt: { gte: start30, lte: now },
      },
      select: { iceconnectSubscribedAt: true },
    }),
  ]);

  const dayLabels30: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayLabels30.push(toDayKey(d));
  }

  const leadCreatedMap = new Map<string, number>();
  for (const r of leadCreatedRows) {
    const k = toDayKey(r.createdAt);
    leadCreatedMap.set(k, (leadCreatedMap.get(k) ?? 0) + 1);
  }
  const tasksCompletedMap = new Map<string, number>();
  for (const r of tasksCompletedRows) {
    const k = toDayKey(r.createdAt);
    tasksCompletedMap.set(k, (tasksCompletedMap.get(k) ?? 0) + 1);
  }
  const subscriptionsMap = new Map<string, number>();
  for (const r of subscriptionsRows as Array<{ iceconnectSubscribedAt: Date | null }>) {
    if (!r.iceconnectSubscribedAt) continue;
    const k = toDayKey(r.iceconnectSubscribedAt);
    subscriptionsMap.set(k, (subscriptionsMap.get(k) ?? 0) + 1);
  }

  const graph30 = dayLabels30.map((day) => ({
    day,
    leadsCreated: leadCreatedMap.get(day) ?? 0,
    tasksCompleted: tasksCompletedMap.get(day) ?? 0,
    subscriptions: subscriptionsMap.get(day) ?? 0,
  }));

  const graph7 = graph30.slice(-7);

  // Rank in team for current period (perf score)
  const memberships = await prisma.userCompany.findMany({
    where: { companyId },
    select: {
      userId: true,
      user: { select: { isActive: true } },
    },
  });
  const ids = memberships.filter((m) => m.user.isActive).map((m) => m.userId);

  const [leadAgg, leadWonAgg, taskCompletedAgg, taskTotalAgg] = await Promise.all([
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: { companyId, assignedTo: { in: ids } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: { companyId, assignedTo: { in: ids }, status: LeadStatus.WON },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["userId"],
      where: { companyId, userId: { in: ids }, status: TaskStatus.COMPLETED },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["userId"],
      where: { companyId, userId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const leadMap = new Map<string, number>();
  for (const r of leadAgg) {
    if (r.assignedTo) leadMap.set(r.assignedTo, r._count._all);
  }
  const wonMap = new Map<string, number>();
  for (const r of leadWonAgg) {
    if (r.assignedTo) wonMap.set(r.assignedTo, r._count._all);
  }
  const taskCompletedMap = new Map<string, number>();
  for (const r of taskCompletedAgg) {
    if (r.userId) taskCompletedMap.set(r.userId, r._count._all);
  }
  const taskTotalMap = new Map<string, number>();
  for (const r of taskTotalAgg) {
    if (r.userId) taskTotalMap.set(r.userId, r._count._all);
  }

  const scores = ids.map((uid) => {
    const lh = leadMap.get(uid) ?? 0;
    const lw = wonMap.get(uid) ?? 0;
    const tc = taskCompletedMap.get(uid) ?? 0;
    const tt = taskTotalMap.get(uid) ?? 0;
    const conversionPercent = lh > 0 ? Math.round((lw / lh) * 100) : 0;
    const efficiencyPercent = tt > 0 ? Math.round((tc / tt) * 100) : 0;
    const perfScore = Math.round(conversionPercent * 0.6 + efficiencyPercent * 0.4);
    return { uid, perfScore, conversionPercent, efficiencyPercent };
  });
  scores.sort((a, b) => b.perfScore - a.perfScore);
  const rank = scores.findIndex((s) => s.uid === employeeId) + 1;
  const rankSafe = rank > 0 ? rank : null;
  const teamSize = scores.length;

  const conversionRate = leadsHandled > 0 ? Math.round((leadsConverted / leadsHandled) * 100) : 0;
  const efficiencyPercent = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;
  const performanceScore = Math.round(conversionRate * 0.6 + efficiencyPercent * 0.4);

  const promotionEligible =
    cfg.promotionEnabled &&
    rankSafe === 1 &&
    performanceScore >= (cfg.promotionPerformanceThreshold ?? 80) &&
    (!cfg.promotionValidUntil || new Date(cfg.promotionValidUntil).getTime() >= now.getTime());

  const revenueGeneratedThisMonth = (revenueGeneratedThisMonthAgg?._sum?.value ?? 0) as number;

  const payoutPreviewRupeesLocked = cfg.kycStatus === "VERIFIED" ? eligibleSalaryRupeesValue + bonusPreview : 0;

  return NextResponse.json({
    ok: true as const,
    employee: {
      id: employeeUser.id,
      name: employeeUser.name,
      email: employeeUser.email,
      phone: employeeUser.mobile ?? "",
      role: userRow.jobRole,
      status: employeeUser.isActive ? "ACTIVE" : "ARCHIVED",
      active: employeeUser.isActive,
      joiningDate: employeeUser.createdAt.toISOString(),
      department: cfg.department,
      assignedClients: leadsHandled,
      pendingTasks,
    },
    performance: {
      leadsHandled,
      leadsConverted,
      conversionRate,
      tasksCompleted,
      efficiencyPercent,
      performanceScore,
      rank: rankSafe,
      teamSize,
      graph30,
      graph7,
      revenueGeneratedThisMonth,
      dealsClosedThisMonth,
    },
    compensation: {
      period: { year: period.year, month: period.month, monthKey: toMonthKey(period.year, period.month) },
      target: {
        targetCount,
        targetPlan,
        baseSalaryRupees,
      },
      achievedConversions,
      currentAchievementPct: progressPct,
      basePayoutPreviewRupees: eligibleSalaryRupeesValue,
      incentivesBonusPreviewRupees: bonusPreview,
      payoutPreviewRupees: payoutPreviewRupeesLocked,
      payoutLockedReason: cfg.kycStatus !== "VERIFIED" ? "Complete KYC to receive payouts" : null,
      kycStatus: cfg.kycStatus,
      canCreatePayrollPayout: cfg.kycStatus === "VERIFIED",
      promotionEligible,
    },
    kyc: {
      status: cfg.kycStatus,
      bankDetails: cfg.kycBankDetails,
      pan: cfg.kycPan,
      panDocumentId: cfg.kycPanDocumentId,
      idDocumentId: cfg.kycIdDocumentId,
      updatedAt: null,
    },
    incentives: {
      enabled: cfg.incentivesEnabled,
      bonusDealsThreshold: cfg.bonusDealsThreshold,
      bonusDealsAmount: cfg.bonusDealsAmount,
      incentivesValidUntil: cfg.incentivesValidUntil,
      promotionEnabled: cfg.promotionEnabled,
      promotionValidUntil: cfg.promotionValidUntil,
      promotionPerformanceThreshold: cfg.promotionPerformanceThreshold,
    },
  });
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    mobile: z.string().trim().min(1).max(32).optional(),
    department: z.string().trim().max(200).optional(),
    incentivesEnabled: z.boolean().optional(),
    bonusDealsThreshold: z.number().int().min(0).optional(),
    bonusDealsAmount: z.number().finite().min(0).optional(),
    incentivesValidUntil: z.string().datetime().optional().nullable(),
    promotionEnabled: z.boolean().optional(),
    promotionValidUntil: z.string().datetime().optional().nullable(),
    promotionPerformanceThreshold: z.number().int().min(0).max(100).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Provide payload" });

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;
  const { id } = await context.params;
  const employeeId = id.trim();

  const json = await request.json().catch(() => null);
  if (!json) return NextResponse.json({ ok: false as const, error: "Invalid JSON body" }, { status: 400 });
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false as const, error: parsed.error.flatten(), code: "VALIDATION_ERROR" }, { status: 400 });
  }

  const org = await getOrCreateInternalSalesCompanyId();
  if ("error" in org) {
    return NextResponse.json({ ok: false as const, error: org.error, code: "INTERNAL_ORG" }, { status: 500 });
  }
  const companyId = org.companyId;

  const { name, mobile, department, incentivesEnabled, bonusDealsThreshold, bonusDealsAmount, incentivesValidUntil, promotionEnabled, promotionValidUntil, promotionPerformanceThreshold } =
    parsed.data;

  const membership = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: employeeId, companyId } },
    select: { userId: true, user: { select: { id: true } }, jobRole: true, status: true },
  });
  if (!membership) return NextResponse.json({ ok: false as const, error: "Employee not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (name !== undefined || mobile !== undefined) {
      await tx.user.update({
        where: { id: membership.userId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(mobile !== undefined ? { mobile } : {}),
        },
      });
    }

    // New columns: update via raw SQL.
    if (department !== undefined) {
      await tx.$executeRawUnsafe(
        `UPDATE "UserCompany" SET "department" = ? WHERE "companyId" = ? AND "userId" = ?`,
        department,
        companyId,
        employeeId,
      );
    }
    if (incentivesEnabled !== undefined) {
      await tx.$executeRawUnsafe(
        `UPDATE "UserCompany" SET "incentivesEnabled" = ? WHERE "companyId" = ? AND "userId" = ?`,
        incentivesEnabled,
        companyId,
        employeeId,
      );
    }
    if (bonusDealsThreshold !== undefined) {
      await tx.$executeRawUnsafe(
        `UPDATE "UserCompany" SET "bonusDealsThreshold" = ? WHERE "companyId" = ? AND "userId" = ?`,
        bonusDealsThreshold,
        companyId,
        employeeId,
      );
    }
    if (bonusDealsAmount !== undefined) {
      await tx.$executeRawUnsafe(
        `UPDATE "UserCompany" SET "bonusDealsAmount" = ? WHERE "companyId" = ? AND "userId" = ?`,
        bonusDealsAmount,
        companyId,
        employeeId,
      );
    }
    if (incentivesValidUntil !== undefined) {
      await tx.$executeRawUnsafe(
        `UPDATE "UserCompany" SET "incentivesValidUntil" = ? WHERE "companyId" = ? AND "userId" = ?`,
        incentivesValidUntil ? new Date(incentivesValidUntil) : null,
        companyId,
        employeeId,
      );
    }
    if (promotionEnabled !== undefined) {
      await tx.$executeRawUnsafe(
        `UPDATE "UserCompany" SET "promotionEnabled" = ? WHERE "companyId" = ? AND "userId" = ?`,
        promotionEnabled,
        companyId,
        employeeId,
      );
    }
    if (promotionValidUntil !== undefined) {
      await tx.$executeRawUnsafe(
        `UPDATE "UserCompany" SET "promotionValidUntil" = ? WHERE "companyId" = ? AND "userId" = ?`,
        promotionValidUntil ? new Date(promotionValidUntil) : null,
        companyId,
        employeeId,
      );
    }
    if (promotionPerformanceThreshold !== undefined) {
      await tx.$executeRawUnsafe(
        `UPDATE "UserCompany" SET "promotionPerformanceThreshold" = ? WHERE "companyId" = ? AND "userId" = ?`,
        promotionPerformanceThreshold,
        companyId,
        employeeId,
      );
    }
  });

  return NextResponse.json({ ok: true as const });
}

