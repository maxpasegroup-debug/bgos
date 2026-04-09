/**
 * Edge-safe trial checks (JWT claims only). No Prisma.
 * Must stay in sync with {@link isBasicTrialExpired} in `trial.ts` for membership `trialEndsAt`.
 */

import { parseJwtMemberships, resolveTenantFromJwt } from "@/lib/auth-active-company";

export const TRIAL_EXPIRED_API_MESSAGE =
  "Your free trial has expired. Upgrade to continue." as const;

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

/** True when active company is BASIC and JWT membership `trialEndsAt` is in the past. */
export function jwtSaysBasicTrialExpired(
  payload: Record<string, unknown>,
  activeCompanyIdCookie: string | undefined,
): boolean {
  const tenant = resolveTenantFromJwt(payload, activeCompanyIdCookie);
  if (tenant.needsCompany || !tenant.companyId) return false;
  if (tenant.companyPlan !== "BASIC") return false;
  const mems = parseJwtMemberships(payload);
  const row = mems?.find((m) => m.companyId === tenant.companyId);
  const iso = row?.trialEndsAt;
  if (!iso) return false;
  const endMs = Date.parse(iso);
  if (Number.isNaN(endMs)) return false;
  return Date.now() >= endMs;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * When Basic trial is expired at the edge: allow reads and a small mutation allowlist
 * (session, checkout, sales contact, company switch). Everything else returns 403 TRIAL_EXPIRED.
 */
export function trialExpiredAllowsApiRequest(pathname: string, method: string): boolean {
  const p = normalizePathname(pathname);
  const m = method.toUpperCase();
  if (!p.startsWith("/api")) return true;
  if (!MUTATING_METHODS.has(m)) return true;

  const allow: [string, string][] = [
    ["/api/auth/refresh-session", "POST"],
    ["/api/auth/logout", "POST"],
    ["/api/payment/checkout", "POST"],
    ["/api/payment/webhook", "POST"],
    ["/api/sales-booster/upgrade-request", "POST"],
    ["/api/company/switch", "POST"],
    ["/api/bgos/growth-plan", "PATCH"],
  ];
  return allow.some(([path, mm]) => p === path && m === mm);
}
