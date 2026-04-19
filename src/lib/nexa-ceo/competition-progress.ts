import { NexaCompetitionMetric } from "@prisma/client";
import type { NexaCompetition } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { getActiveSubscriptionCount } from "@/lib/sales-hierarchy/active-subscriptions";

/**
 * Live progress for a user toward a competition target (recomputed on read).
 */
export async function computeCompetitionProgress(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
  competition: Pick<NexaCompetition, "targetMetric" | "startDate" | "endDate">,
): Promise<number> {
  const { targetMetric, startDate, endDate } = competition;
  switch (targetMetric) {
    case NexaCompetitionMetric.LEADS:
      return prisma.lead.count({
        where: {
          companyId,
          assignedTo: userId,
          createdAt: { gte: startDate, lte: endDate },
        },
      });
    case NexaCompetitionMetric.SUBSCRIPTIONS:
      return getActiveSubscriptionCount(prisma, companyId, userId);
    case NexaCompetitionMetric.POINTS: {
      const uc = await prisma.userCompany.findUnique({
        where: { userId_companyId: { userId, companyId } },
        select: { totalPoints: true },
      });
      return uc?.totalPoints ?? 0;
    }
    case NexaCompetitionMetric.REVENUE: {
      const agg = await prisma.invoicePayment.aggregate({
        where: {
          companyId,
          date: { gte: startDate, lte: endDate },
          invoice: { lead: { assignedTo: userId } },
        },
        _sum: { amount: true },
      });
      return agg._sum.amount ?? 0;
    }
    default:
      return 0;
  }
}
