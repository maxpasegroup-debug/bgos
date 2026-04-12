import { CompanyPlan } from "@prisma/client";

/** Permanent billing / Sales Booster override — only this login. */
export const BGOS_PRODUCTION_BOSS_BYPASS_EMAIL = "boss@bgos.online";

export function isBgosProductionBossBypassEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  return e.length > 0 && e === BGOS_PRODUCTION_BOSS_BYPASS_EMAIL;
}

type JwtMembershipLike = {
  companyId: string;
  plan: CompanyPlan;
  jobRole?: unknown;
  trialEndsAt?: string | null;
  subscriptionPeriodEnd?: string | null;
};

/**
 * Forces PRO + long paid window in JWT membership rows so Edge trial/subscription checks stay open.
 */
export function applyProductionBossJwtMembershipOverrides<T extends JwtMembershipLike>(
  email: string,
  memberships: T[],
): T[] {
  if (!isBgosProductionBossBypassEmail(email) || memberships.length === 0) return memberships;
  const far = new Date();
  far.setFullYear(far.getFullYear() + 25);
  const farIso = far.toISOString();
  return memberships.map((m) => ({
    ...m,
    plan: CompanyPlan.PRO,
    subscriptionPeriodEnd: farIso,
    trialEndsAt: null,
  }));
}
