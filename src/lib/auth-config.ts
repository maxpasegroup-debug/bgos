/**
 * Auth constants safe to import from Edge middleware (no Node-only APIs).
 */
export const AUTH_COOKIE_NAME = "bgos_session";
export const AUTH_JWT_ISSUER = "bgos";

/** Request headers set by middleware after JWT verification (do not trust from clients). */
export const AUTH_HEADER_USER_ID = "x-bgos-user-id";
export const AUTH_HEADER_USER_EMAIL = "x-bgos-user-email";
export const AUTH_HEADER_USER_ROLE = "x-bgos-user-role";
export const AUTH_HEADER_COMPANY_ID = "x-bgos-company-id";
/** Set from JWT in middleware; `BASIC` | `PRO`. */
export const AUTH_HEADER_COMPANY_PLAN = "x-bgos-company-plan";

export const AUTH_HEADER_PREFIX = "x-bgos-";

/**
 * API routes under these prefixes require `companyPlan === PRO` in JWT (middleware + handlers).
 */
export const PRO_PLAN_API_PREFIXES = ["/api/automation"] as const;

export function companyPlanFromJwtClaim(raw: unknown): "BASIC" | "PRO" {
  return raw === "PRO" ? "PRO" : "BASIC";
}

export function pathnameRequiresProPlan(pathname: string): boolean {
  return PRO_PLAN_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
