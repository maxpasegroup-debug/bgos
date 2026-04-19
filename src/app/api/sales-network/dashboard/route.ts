import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SalesNetworkRole } from "@prisma/client";
import { logCaughtError } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveSubscriptionCount } from "@/lib/sales-hierarchy/active-subscriptions";
import { BDE_TO_BDM_ACTIVE_SUBS, BDM_TO_RSM_MIN_BDES, BDM_TO_RSM_MIN_NETWORK_POINTS } from "@/config/sales-hierarchy";

/**
 * Role-scoped sales network snapshot for `/dashboard/bde|bdm|rsm`.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthWithCompany(request);
    if (session instanceof NextResponse) return session;

    const companyId = session.companyId;
    const mem = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: session.sub, companyId } },
      select: {
        salesNetworkRole: true,
        activeSubscriptionsCount: true,
        totalPoints: true,
        recurringCap: true,
        bdeSlotLimit: true,
        region: true,
        parentUserId: true,
      },
    });

    const snr = mem?.salesNetworkRole ?? null;

    const [earningsAgg, leadsAssigned, teamBdeCount, promotionRow] = await Promise.all([
      prisma.salesHierarchyEarning.aggregate({
        where: { companyId, userId: session.sub },
        _sum: { amount: true },
      }),
      snr === SalesNetworkRole.BDE || !snr
        ? prisma.lead.count({ where: { companyId, assignedTo: session.sub } })
        : Promise.resolve(0),
      snr === SalesNetworkRole.BDM || snr === SalesNetworkRole.RSM
        ? prisma.userCompany.count({
            where: {
              companyId,
              parentUserId: session.sub,
              salesNetworkRole: SalesNetworkRole.BDE,
              archivedAt: null,
            },
          })
        : Promise.resolve(0),
      prisma.promotionTracker.findUnique({
        where: { companyId_userId: { companyId, userId: session.sub } },
        select: {
          eligibleForPromotion: true,
          roleTarget: true,
          activeCountSnapshot: true,
        },
      }),
    ]);

    const activeSubs = await getActiveSubscriptionCount(prisma, companyId, session.sub);

    let regionTeamPoints = 0;
    let bdmUnderRsm = 0;
    if (snr === SalesNetworkRole.RSM) {
      const bdms = await prisma.userCompany.findMany({
        where: {
          companyId,
          parentUserId: session.sub,
          salesNetworkRole: SalesNetworkRole.BDM,
          archivedAt: null,
        },
        select: { userId: true },
      });
      bdmUnderRsm = bdms.length;
      for (const b of bdms) {
        const subs = await prisma.userCompany.findMany({
          where: {
            companyId,
            parentUserId: b.userId,
            salesNetworkRole: SalesNetworkRole.BDE,
            archivedAt: null,
          },
          select: { userId: true },
        });
        for (const s of subs) {
          regionTeamPoints += await getActiveSubscriptionCount(prisma, companyId, s.userId);
        }
      }
    }

    return NextResponse.json({
      ok: true as const,
      role: snr,
      work_board: {
        leads_assigned: leadsAssigned,
        team_bde_count: teamBdeCount,
        bdm_under_rsm: bdmUnderRsm,
        region_team_subscription_points: regionTeamPoints,
      },
      performance: {
        active_subscriptions_count: activeSubs,
        total_points: mem?.totalPoints ?? 0,
        recurring_cap: mem?.recurringCap ?? true,
        bde_slot_limit: mem?.bdeSlotLimit ?? 0,
        region: mem?.region ?? null,
        promotion_eligible: promotionRow?.eligibleForPromotion ?? false,
        promotion_target_role: promotionRow?.roleTarget ?? null,
        thresholds: {
          bde_to_bdm_active_subs: BDE_TO_BDM_ACTIVE_SUBS,
          bdm_to_rsm_min_bdes: BDM_TO_RSM_MIN_BDES,
          bdm_to_rsm_min_network_points: BDM_TO_RSM_MIN_NETWORK_POINTS,
        },
      },
      earnings: {
        total_inr: earningsAgg._sum.amount ?? 0,
      },
    });
  } catch (e) {
    console.error("GET /api/sales-network/dashboard", e);
    logCaughtError("sales-network-dashboard", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load dashboard", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
