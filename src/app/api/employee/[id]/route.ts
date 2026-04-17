import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.SALES_HEAD];
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const session = await requireAuthWithRoles(request, ALLOWED);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const userId = id.trim();
  if (!userId) {
    return NextResponse.json({ success: false as const, message: "Missing employee id" }, { status: 400 });
  }

  try {
    const member = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId: session.companyId } },
      select: {
        userId: true,
        jobRole: true,
        status: true,
        user: { select: { name: true, email: true, mobile: true, createdAt: true, isActive: true } },
      },
    });

    if (!member) {
      return NextResponse.json({ success: false as const, message: "Employee not found" }, { status: 404 });
    }

    const now = new Date();
    const [target, leadsHandled, dealsWon, revenue, pendingTasks, completedTasks, incentivesRows] =
      await Promise.all([
        prisma.salesExecutiveMonthlyTarget.findFirst({
          where: { companyId: session.companyId, userId },
          orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        }),
        prisma.lead.count({ where: { companyId: session.companyId, assignedTo: userId } }),
        prisma.deal.count({ where: { companyId: session.companyId, status: "WON", lead: { assignedTo: userId } } }),
        prisma.deal.aggregate({ where: { companyId: session.companyId, status: "WON", lead: { assignedTo: userId } }, _sum: { value: true } }),
        prisma.task.count({ where: { companyId: session.companyId, userId, status: "PENDING" } }),
        prisma.task.count({ where: { companyId: session.companyId, userId, status: "COMPLETED" } }),
        prisma.$queryRawUnsafe<Array<{ incentivesEnabled: boolean; bonusDealsThreshold: number; bonusDealsAmount: number; incentivesValidUntil: Date | null; promotionEnabled: boolean; promotionValidUntil: Date | null; promotionPerformanceThreshold: number }>>(
          `SELECT "incentivesEnabled", "bonusDealsThreshold", "bonusDealsAmount", "incentivesValidUntil", "promotionEnabled", "promotionValidUntil", "promotionPerformanceThreshold" FROM "UserCompany" WHERE "companyId" = ? AND "userId" = ?`,
          session.companyId,
          userId,
        ),
      ]);

    const incentives = incentivesRows[0] ?? {
      incentivesEnabled: false,
      bonusDealsThreshold: 0,
      bonusDealsAmount: 0,
      incentivesValidUntil: null,
      promotionEnabled: false,
      promotionValidUntil: null,
      promotionPerformanceThreshold: 80,
    };

    return NextResponse.json({
      success: true as const,
      data: {
        name: member.user.name,
        role: member.jobRole,
        email: member.user.email,
        salary: target?.salaryRupees ?? 0,
        status: member.user.isActive ? "ACTIVE" : "INACTIVE",
        targets: {
          targetCount: target?.targetCount ?? 0,
          targetPlan: target?.targetPlan ?? null,
          periodYear: target?.periodYear ?? now.getUTCFullYear(),
          periodMonth: target?.periodMonth ?? now.getUTCMonth() + 1,
        },
        performance: {
          leadsHandled,
          dealsWon,
          conversionRate: leadsHandled > 0 ? Math.round((dealsWon / leadsHandled) * 100) : 0,
          pendingTasks,
          completedTasks,
          revenueGenerated: revenue._sum.value ?? 0,
        },
        incentives: {
          enabled: incentives.incentivesEnabled,
          bonusDealsThreshold: incentives.bonusDealsThreshold,
          bonusDealsAmount: incentives.bonusDealsAmount,
          incentivesValidUntil: incentives.incentivesValidUntil,
          promotionEnabled: incentives.promotionEnabled,
          promotionValidUntil: incentives.promotionValidUntil,
          promotionPerformanceThreshold: incentives.promotionPerformanceThreshold,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/employee/[id]", error);
    return NextResponse.json({ success: false as const, message: "Failed to load employee data" }, { status: 500 });
  }
}
