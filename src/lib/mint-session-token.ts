import "server-only";

import { UserRole } from "@prisma/client";
import { signAccessToken } from "@/lib/jwt";
import { loadMembershipsForJwt, type JwtMembershipRow } from "@/lib/memberships-for-jwt";
import { prisma } from "@/lib/prisma";
import { applyProductionBossJwtMembershipOverrides } from "@/lib/bgos-production-boss-bypass";
import { isSuperBossEmail } from "@/lib/super-boss";

export type MintSessionTokenErrorCode = "NO_USER" | "NO_MEMBERSHIP" | "NO_COMPANY";

export class MintSessionTokenError extends Error {
  readonly code: MintSessionTokenErrorCode;

  constructor(code: MintSessionTokenErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

/**
 * Issue a JWT whose `memberships[].plan` values are loaded from {@link Company.plan}
 * (subscription is per company). Top-level `companyId` / `companyPlan` / `role` match
 * the active company row.
 */
export async function mintSessionAccessToken(input: {
  userId: string;
  email: string;
  activeCompanyId: string;
}): Promise<string> {
  const [memsRaw, user] = await Promise.all([
    loadMembershipsForJwt(input.userId),
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { workspaceActivatedAt: true },
    }),
  ]);

  if (!user) {
    throw new MintSessionTokenError("NO_USER");
  }

  const mems = applyProductionBossJwtMembershipOverrides(input.email, memsRaw);

  const row = mems.find((m) => m.companyId === input.activeCompanyId);
  if (!row) {
    throw new MintSessionTokenError("NO_MEMBERSHIP");
  }

  const workspaceReady = Boolean(user.workspaceActivatedAt);

  return signAccessToken({
    sub: input.userId,
    email: input.email,
    role: row.jobRole,
    companyId: row.companyId,
    companyPlan: row.plan,
    workspaceReady,
    memberships: mems,
    ...(isSuperBossEmail(input.email) ? { superBoss: true as const } : {}),
  });
}

function dedupeMemberships(rows: JwtMembershipRow[]): JwtMembershipRow[] {
  const seen = new Map<string, JwtMembershipRow>();
  for (const r of rows) {
    if (!seen.has(r.companyId)) seen.set(r.companyId, r);
  }
  return Array.from(seen.values());
}

/**
 * Re-issue JWT after company switch (or refresh). Super boss may activate any company
 * even without a `UserCompany` row; that company is merged into `memberships` for Edge resolution.
 */
export async function mintSessionAccessTokenForUser(input: {
  userId: string;
  email: string;
  activeCompanyId: string;
}): Promise<string> {
  if (!isSuperBossEmail(input.email)) {
    return mintSessionAccessToken(input);
  }

  const [mems, user] = await Promise.all([
    loadMembershipsForJwt(input.userId),
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { workspaceActivatedAt: true },
    }),
  ]);

  if (!user) {
    throw new MintSessionTokenError("NO_USER");
  }

  let rows = applyProductionBossJwtMembershipOverrides(input.email, [...mems]);
  const hasRow = rows.some((m) => m.companyId === input.activeCompanyId);
  if (!hasRow) {
    const co = await prisma.company.findUnique({
      where: { id: input.activeCompanyId },
      select: {
        plan: true,
        trialEndDate: true,
        subscriptionPeriodEnd: true,
        subscriptionStatus: true,
      },
    });
    if (!co) {
      throw new MintSessionTokenError("NO_COMPANY");
    }
    rows.push({
      companyId: input.activeCompanyId,
      plan: co.plan,
      jobRole: UserRole.ADMIN,
      trialEndsAt: co.trialEndDate?.toISOString() ?? null,
      subscriptionPeriodEnd: co.subscriptionPeriodEnd?.toISOString() ?? null,
      subscriptionStatus: co.subscriptionStatus,
    });
  }
  rows = dedupeMemberships(rows);

  const activeRow = rows.find((m) => m.companyId === input.activeCompanyId);
  if (!activeRow) {
    throw new MintSessionTokenError("NO_MEMBERSHIP");
  }

  const workspaceReady = Boolean(user.workspaceActivatedAt);

  return signAccessToken({
    sub: input.userId,
    email: input.email,
    role: activeRow.jobRole,
    companyId: activeRow.companyId,
    companyPlan: activeRow.plan,
    workspaceReady,
    memberships: rows.map((m) => ({
      companyId: m.companyId,
      plan: m.plan,
      jobRole: m.jobRole,
      trialEndsAt: m.trialEndsAt,
      subscriptionPeriodEnd: m.subscriptionPeriodEnd,
      subscriptionStatus: m.subscriptionStatus,
    })),
    superBoss: true as const,
  });
}
