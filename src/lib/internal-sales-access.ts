/**
 * Access-control scoping for the Internal Sales Engine.
 *
 * Visibility rules:
 *   BDE        — sees only own data
 *   BDM        — sees own data + all direct BDE children
 *   RSM        — sees own data + all BDMs in region + their BDEs
 *   BOSS       — sees everything in the internal org
 */

import "server-only";

import { SalesNetworkRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { AuthUser } from "@/lib/auth";
import { getInternalUserRole } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";

// ---------------------------------------------------------------------------
// Session type
// ---------------------------------------------------------------------------

export type InternalSalesSession = {
  userId: string;
  companyId: string;
  salesNetworkRole: SalesNetworkRole;
};

// ---------------------------------------------------------------------------
// requireInternalSalesSession
// ---------------------------------------------------------------------------

/**
 * Validates the caller is an authenticated internal staff member with a
 * `salesNetworkRole` set.  Returns `InternalSalesSession` or a `NextResponse`.
 */
export async function requireInternalSalesSession(
  user: AuthUser,
): Promise<InternalSalesSession | NextResponse> {
  const internalUser = await getInternalUserRole(user.sub);
  if (!internalUser) {
    return NextResponse.json(
      { ok: false as const, error: "Internal sales access only.", code: "FORBIDDEN" as const },
      { status: 403 },
    );
  }

  const org = await getOrCreateInternalSalesCompanyId();
  if ("error" in org) {
    return NextResponse.json(
      { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
      { status: 500 },
    );
  }

  return {
    userId: user.sub,
    companyId: org.companyId,
    salesNetworkRole: internalUser.salesNetworkRole,
  };
}

// ---------------------------------------------------------------------------
// Scoped user-id list builders
// ---------------------------------------------------------------------------

/**
 * Returns the set of userIds visible to `actorUserId` based on their role.
 *
 * BDE   → [self]
 * BDM   → [self, ...direct BDEs]
 * RSM   → [self, ...direct BDMs, ...BDEs under those BDMs]
 * BOSS  → all non-archived members of the org
 */
export async function getScopedUserIds(
  companyId: string,
  actorUserId: string,
  actorRole: SalesNetworkRole,
): Promise<string[]> {
  if (actorRole === SalesNetworkRole.BOSS) {
    const all = await prisma.userCompany.findMany({
      where: { companyId, archivedAt: null, salesNetworkRole: { not: null } },
      select: { userId: true },
    });
    return all.map((m) => m.userId);
  }

  if (actorRole === SalesNetworkRole.RSM) {
    // Direct BDMs
    const bdms = await prisma.userCompany.findMany({
      where: { companyId, parentUserId: actorUserId, salesNetworkRole: SalesNetworkRole.BDM, archivedAt: null },
      select: { userId: true },
    });
    const bdmIds = bdms.map((m) => m.userId);

    // BDEs under those BDMs
    const bdes = bdmIds.length
      ? await prisma.userCompany.findMany({
          where: { companyId, parentUserId: { in: bdmIds }, salesNetworkRole: SalesNetworkRole.BDE, archivedAt: null },
          select: { userId: true },
        })
      : [];

    return [actorUserId, ...bdmIds, ...bdes.map((m) => m.userId)];
  }

  if (actorRole === SalesNetworkRole.BDM) {
    const bdes = await prisma.userCompany.findMany({
      where: { companyId, parentUserId: actorUserId, salesNetworkRole: SalesNetworkRole.BDE, archivedAt: null },
      select: { userId: true },
    });
    return [actorUserId, ...bdes.map((m) => m.userId)];
  }

  // BDE — sees only own data
  return [actorUserId];
}

// ---------------------------------------------------------------------------
// Scoped Prisma where clauses
// ---------------------------------------------------------------------------

export async function scopedEarningsWhere(session: InternalSalesSession) {
  const ids = await getScopedUserIds(session.companyId, session.userId, session.salesNetworkRole);
  return { companyId: session.companyId, userId: { in: ids } };
}

export async function scopedSubscriptionsWhere(session: InternalSalesSession) {
  const ids = await getScopedUserIds(session.companyId, session.userId, session.salesNetworkRole);
  return { companyId: session.companyId, ownerUserId: { in: ids } };
}

// ---------------------------------------------------------------------------
// Team roster — scoped member list with stats
// ---------------------------------------------------------------------------

export type TeamMemberRow = {
  userId: string;
  name: string;
  email: string;
  salesNetworkRole: SalesNetworkRole | null;
  parentUserId: string | null;
  region: string | null;
  totalPoints: number;
  activeSubscriptionsCount: number;
  archivedAt: string | null;
};

export type ScopedTeamResult = {
  members: TeamMemberRow[];
  total: number;
};

/**
 * Returns a paginated team roster scoped to the caller's role.
 *
 * Uses a single query for the roster + a count query for total — no N+1.
 * Active-subscription live counts are fetched in ONE batch GROUP BY query
 * by the team API route after calling this function.
 *
 * @param take  Page size (default 20, max 100)
 * @param skip  Offset (default 0)
 */
export async function getScopedTeam(
  session: InternalSalesSession,
  take = 20,
  skip = 0,
): Promise<ScopedTeamResult> {
  const ids = await getScopedUserIds(session.companyId, session.userId, session.salesNetworkRole);

  const clampedTake = Math.min(100, Math.max(1, take));
  const clampedSkip = Math.max(0, skip);

  const where = { companyId: session.companyId, userId: { in: ids } };

  const [members, total] = await Promise.all([
    prisma.userCompany.findMany({
      where,
      select: {
        salesNetworkRole: true,
        parentUserId: true,
        region: true,
        totalPoints: true,
        activeSubscriptionsCount: true,
        archivedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
      take: clampedTake,
      skip: clampedSkip,
    }),
    prisma.userCompany.count({ where }),
  ]);

  return {
    members: members.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      salesNetworkRole: m.salesNetworkRole,
      parentUserId: m.parentUserId,
      region: m.region,
      totalPoints: m.totalPoints,
      activeSubscriptionsCount: m.activeSubscriptionsCount,
      archivedAt: m.archivedAt?.toISOString() ?? null,
    })),
    total,
  };
}
