/**
 * Auth constants safe to import from Edge middleware (no Node-only APIs).
 */
import { jwtCompanyPlanFromUnknown, type JwtCompanyPlan } from "./plan-tier";

/** HTTP-only JWT session cookie (middleware + APIs). */
export const AUTH_COOKIE_NAME = "token";
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
/** `"1"` when JWT carries `superBoss: true` (BGOS_BOSS_EMAIL owner mode). */
export const AUTH_HEADER_SUPER_BOSS = "x-bgos-super-boss";
/**
 * `BASIC` | `PRO` | `ENTERPRISE` for the **active** company (cookie + JWT `memberships[].plan`).
 * Edge middleware gates Pro+ APIs using this header (PRO and ENTERPRISE both pass Pro gates).
 */
export const AUTH_HEADER_COMPANY_PLAN = "x-bgos-company-plan";

export const AUTH_HEADER_PREFIX = "x-bgos-";

/**
 * API routes under these prefixes require an active-company **Pro+** plan at Edge
 * (PRO or ENTERPRISE; see `plan-tier.ts`). Route handlers must still verify {@link Company.plan}.
 */
export const PRO_PLAN_API_PREFIXES = ["/api/automation"] as const;

/**
 * Pro-gated `/api/sales-booster/*` except these paths (Basic upgrade funnel).
 */
export const PRO_PLAN_SALES_BOOSTER_PREFIX = "/api/sales-booster";

export const PRO_PLAN_SALES_BOOSTER_ALLOWLIST = [
  "/api/sales-booster/upgrade-request",
] as const;

export function companyPlanFromJwtClaim(raw: unknown): JwtCompanyPlan {
  return jwtCompanyPlanFromUnknown(raw);
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
