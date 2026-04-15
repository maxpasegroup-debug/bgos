import { NextResponse } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import {
  companyHasSubscription,
  runNexaDecisionEngine,
  type NexaDecisionInput,
} from "@/lib/nexa-decision-engine";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/route-error";

export async function GET(request: Request) {
  const user = await requireAuthWithCompany(request);
  if (user instanceof NextResponse) return user;

  try {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      leadsCount,
      newLeadsStuck2d,
      onboardingWeekCount,
      onboardingMonthCount,
      companyRow,
      ownerRow,
      inactiveEmployees2d,
      activeSubscriptions,
      pendingPayments,
      last30Revenue,
      prev30Revenue,
    ] = await Promise.all([
      prisma.lead.count({ where: { companyId: user.companyId } }),
      prisma.lead.count({
        where: {
          companyId: user.companyId,
          status: "NEW",
          updatedAt: { lt: twoDaysAgo },
        },
      }),
      prisma.onboarding.count({
        where: { createdBy: user.sub, createdAt: { gte: weekStart } },
      }),
      prisma.onboarding.count({
        where: { createdBy: user.sub, createdAt: { gte: monthStart } },
      }),
      prisma.company.findUnique({
        where: { id: user.companyId },
        select: { ownerId: true, subscriptionStatus: true },
      }),
      prisma.user.findUnique({ where: { id: user.sub }, select: { lastLogin: true } }),
      prisma.userCompany.count({
        where: {
          companyId: user.companyId,
          user: { lastLogin: { lt: twoDaysAgo } },
        },
      }),
      prisma.company.count({
        where: { ownerId: user.sub, subscriptionStatus: { in: ["ACTIVE", "TRIAL"] } },
      }),
      prisma.invoice.count({
        where: { companyId: user.companyId, status: { not: "PAID" } },
      }),
      prisma.payment.aggregate({
        where: { companyId: user.companyId, createdAt: { gte: new Date(now.getTime() - 30 * 86400000) } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          companyId: user.companyId,
          createdAt: {
            gte: new Date(now.getTime() - 60 * 86400000),
            lt: new Date(now.getTime() - 30 * 86400000),
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const ownerLastLoginDays =
      ownerRow?.lastLogin != null
        ? Math.floor((now.getTime() - ownerRow.lastLogin.getTime()) / (24 * 60 * 60 * 1000))
        : null;
    const currentRevenue = Number(last30Revenue._sum.amount ?? 0);
    const previousRevenue = Number(prev30Revenue._sum.amount ?? 0);
    const growthTrendPercent =
      previousRevenue > 0 ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100) : 0;

    const decisionInput: NexaDecisionInput = {
      now,
      leadsCount,
      newLeadsStuck2d,
      onboardingWeekCount,
      onboardingMonthCount,
      hasSubscription: companyHasSubscription(companyRow?.subscriptionStatus),
      ownerLastLoginDays,
      inactiveEmployees2d,
      activeSubscriptions,
      pendingPayments,
      growthTrendPercent,
    };

    const decision = runNexaDecisionEngine(decisionInput);
    const nextAction =
      decision.actions[0]?.message ?? "Start your day. Add 3 leads.";
    const badgeCount = decision.actions.length;

    return jsonSuccess({
      nextAction,
      badgeCount,
      userState: decision.userState,
      actions: decision.actions,
      dailyNudge: decision.dailyNudge,
      weeklyNudge: decision.weeklyNudge,
      monthlyNudge: decision.monthlyNudge,
    });
  } catch (e) {
    return handleApiError("GET /api/nexa/next-action", e);
  }
}
