/**
 * JWT / middleware plan strings — mirrors {@link CompanyPlan} from Prisma.
 * Edge-safe (no Prisma client).
 */

export type JwtCompanyPlan = "BASIC" | "PRO" | "ENTERPRISE";

export function jwtCompanyPlanFromUnknown(raw: unknown): JwtCompanyPlan {
  if (raw === "ENTERPRISE") return "ENTERPRISE";
  if (raw === "PRO") return "PRO";
  return "BASIC";
}

/** PRO tier = PRO + ENTERPRISE (shared “Pro+” product entitlements). */
export function jwtPlanIsProPlus(plan: JwtCompanyPlan): boolean {
  return plan === "PRO" || plan === "ENTERPRISE";
}

export function jwtPlanIsEnterpriseOnly(plan: JwtCompanyPlan): boolean {
  return plan === "ENTERPRISE";
}
