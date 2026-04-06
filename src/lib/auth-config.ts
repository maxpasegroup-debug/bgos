/**
 * Auth constants safe to import from Edge middleware (no Node-only APIs).
 */
export const AUTH_COOKIE_NAME = "bgos_session";
/** HTTP-only cookie: validated against JWT memberships in middleware; DB check in APIs. */
export const ACTIVE_COMPANY_COOKIE_NAME = "activeCompanyId";
export const AUTH_JWT_ISSUER = "bgos";

/** Request headers set by middleware after JWT verification (do not trust from clients). */
export const AUTH_HEADER_USER_ID = "x-bgos-user-id";
export const AUTH_HEADER_USER_EMAIL = "x-bgos-user-email";
export const AUTH_HEADER_USER_ROLE = "x-bgos-user-role";
export const AUTH_HEADER_COMPANY_ID = "x-bgos-company-id";
/** Set to `"1"` when JWT has no workspace yet (post-signup onboarding). */
export const AUTH_HEADER_NEEDS_COMPANY = "x-bgos-needs-company";
/** `"1"` | `"0"` — boss completed NEXA activation step (`workspaceReady` claim). */
export const AUTH_HEADER_WORKSPACE_READY = "x-bgos-workspace-ready";
/**
 * `BASIC` | `PRO` for the **active** company (cookie + JWT `memberships[].plan` from
 * {@link Company.plan}). Edge middleware gates Pro-only APIs using this header.
 */
export const AUTH_HEADER_COMPANY_PLAN = "x-bgos-company-plan";

export const AUTH_HEADER_PREFIX = "x-bgos-";

/**
 * API routes under these prefixes require an active-company **Pro** plan at Edge
 * (`x-bgos-company-plan`, derived from JWT membership for `activeCompanyId`).
 * Route handlers must still verify {@link Company.plan} in the DB (source of truth).
 */
export const PRO_PLAN_API_PREFIXES = ["/api/automation"] as const;

/**
 * Pro-gated `/api/sales-booster/*` except these paths (Basic upgrade funnel).
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
