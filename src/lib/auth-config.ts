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
 * API routes under these prefixes require `companyPlan === PRO` in the session JWT (Edge middleware).
 * Handlers should still verify {@link Company.plan} in the database when returning Pro-only data.
 */
export const PRO_PLAN_API_PREFIXES = ["/api/automation"] as const;

/**
 * Pro-gated `/api/sales-booster/*` except these exact paths (Basic monetization / upgrade funnel).
 */
export const PRO_PLAN_SALES_BOOSTER_PREFIX = "/api/sales-booster";

export const PRO_PLAN_SALES_BOOSTER_ALLOWLIST = [
  "/api/sales-booster/upgrade-request",
] as const;

export function companyPlanFromJwtClaim(raw: unknown): "BASIC" | "PRO" {
  return raw === "PRO" ? "PRO" : "BASIC";
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

/**
 * True when the request must be blocked for Basic companies at the middleware (403 JSON for `/api/*`).
 */
export function pathnameRequiresProPlan(pathname: string): boolean {
  const p = normalizePathname(pathname);

  if (
    (PRO_PLAN_SALES_BOOSTER_ALLOWLIST as readonly string[]).some(
      (allowed) => p === allowed,
    )
  ) {
    return false;
  }

  if (
    p === PRO_PLAN_SALES_BOOSTER_PREFIX ||
    p.startsWith(`${PRO_PLAN_SALES_BOOSTER_PREFIX}/`)
  ) {
    return true;
  }

  return PRO_PLAN_API_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`),
  );
}
