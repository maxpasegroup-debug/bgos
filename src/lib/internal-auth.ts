/**
 * Internal (BGOS platform staff) role system.
 *
 * Uses the existing `SalesNetworkRole` field on `UserCompany` to identify
 * internal users — completely orthogonal to the tenant `UserRole` (ADMIN /
 * MANAGER / SALES_EXECUTIVE …) used by the client-facing BGOS / ICECONNECT
 * apps.  No schema changes required.
 *
 * is_internal ≡ UserCompany.salesNetworkRole IS NOT NULL
 */

import "server-only";

import { SalesNetworkRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type InternalRole = SalesNetworkRole;

export const INTERNAL_ROLES = [
  SalesNetworkRole.BOSS,
  SalesNetworkRole.RSM,
  SalesNetworkRole.BDM,
  SalesNetworkRole.BDE,
  SalesNetworkRole.TECH_EXEC,
] as const;

/** The named roles as requested by the spec. */
export const INTERNAL_ROLE_LABELS: Record<InternalRole, string> = {
  [SalesNetworkRole.BOSS]: "internal_boss",
  [SalesNetworkRole.RSM]: "internal_rsm",
  [SalesNetworkRole.BDM]: "internal_bdm",
  [SalesNetworkRole.BDE]: "internal_bde",
  [SalesNetworkRole.TECH_EXEC]: "tech_exec",
};

/**
 * Role → default home for internal users after login.
 *
 * internal_boss   → /internal/control
 * internal_rsm    → /internal/sales
 * internal_bdm    → /internal/sales
 * internal_bde    → /internal/sales
 * tech_exec       → /internal/tech
 */
export const INTERNAL_ROLE_HOME: Record<InternalRole, string> = {
  [SalesNetworkRole.BOSS]: "/internal/control",
  [SalesNetworkRole.RSM]: "/internal/sales",
  [SalesNetworkRole.BDM]: "/internal/sales",
  [SalesNetworkRole.BDE]: "/internal/sales",
  [SalesNetworkRole.TECH_EXEC]: "/internal/tech",
};

export function getInternalRoleHome(role: InternalRole): string {
  return INTERNAL_ROLE_HOME[role] ?? "/internal/sales";
}

export function isInternalRole(role: unknown): role is InternalRole {
  return (INTERNAL_ROLES as readonly string[]).includes(role as string);
}

/** Per-route role access: which internal roles may visit each /internal/* path. */
export const INTERNAL_ROUTE_ROLES: Record<string, readonly InternalRole[]> = {
  "/internal/control": [SalesNetworkRole.BOSS],
  "/internal/sales": [
    SalesNetworkRole.BOSS,
    SalesNetworkRole.RSM,
    SalesNetworkRole.BDM,
    SalesNetworkRole.BDE,
  ],
  "/internal/team": INTERNAL_ROLES,
  "/internal/tech": [SalesNetworkRole.BOSS, SalesNetworkRole.TECH_EXEC],
  "/internal/wallet": INTERNAL_ROLES,
  "/internal/onboard-company": [SalesNetworkRole.BOSS, SalesNetworkRole.RSM],
};

export type InternalUser = {
  userId: string;
  email: string;
  salesNetworkRole: InternalRole;
  isInternal: true;
};

/**
 * Fetch the caller's internal role from `UserCompany`.
 * Returns `null` when the user has no `salesNetworkRole` (i.e. not internal).
 */
export async function getInternalUserRole(userId: string): Promise<InternalUser | null> {
  const membership = await prisma.userCompany.findFirst({
    where: { userId, salesNetworkRole: { not: null } },
    select: {
      salesNetworkRole: true,
      user: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!membership?.salesNetworkRole) return null;
  if (!isInternalRole(membership.salesNetworkRole)) return null;

  return {
    userId,
    email: membership.user.email,
    salesNetworkRole: membership.salesNetworkRole,
    isInternal: true,
  };
}

/**
 * True when the path is under the /internal tree (excluding /internal/login).
 */
export function isInternalPath(pathname: string): boolean {
  if (pathname === "/internal/login" || pathname.startsWith("/internal/login/")) return false;
  return pathname === "/internal" || pathname.startsWith("/internal/");
}

/**
 * Check whether an internal role is permitted to visit a given /internal path.
 */
export function internalRoleCanAccess(role: InternalRole, pathname: string): boolean {
  for (const [prefix, roles] of Object.entries(INTERNAL_ROUTE_ROLES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return (roles as readonly string[]).includes(role);
    }
  }
  // Unknown internal paths: allow all internal roles
  return true;
}
