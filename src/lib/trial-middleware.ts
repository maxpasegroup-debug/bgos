/**
 * Edge-safe subscription checks (JWT claims only). No Prisma.
 * Keep aligned with {@link deriveSubscriptionStatus} and {@link isCompanyBasicTrialExpired}.
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

function subscriptionPeriodEndMs(row: { subscriptionPeriodEnd: string | null }): number | null {
  const iso = row.subscriptionPeriodEnd;
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * True when the active company must not use the product without visiting billing (BASIC trial ended
 * without pay, PRO period ended when `subscriptionPeriodEnd` is present in JWT, etc.).
 */
/**
 * Custom-build company selected a plan but has not completed initial checkout yet
 * ({@link CompanySubscriptionStatus.PAYMENT_PENDING} in JWT membership row).
 */
export function jwtSaysCustomPaymentPending(
  payload: Record<string, unknown>,
  activeCompanyIdCookie: string | undefined,
): boolean {
  const tenant = resolveTenantFromJwt(payload, activeCompanyIdCookie);
  if (tenant.needsCompany || !tenant.companyId) return false;

  const mems = parseJwtMemberships(payload);
  const row = mems?.find((m) => m.companyId === tenant.companyId);
  if (!row?.subscriptionStatus) return false;
  return row.subscriptionStatus === "PAYMENT_PENDING";
}

export function jwtSaysSubscriptionExpired(
  payload: Record<string, unknown>,
  activeCompanyIdCookie: string | undefined,
): boolean {
  const tenant = resolveTenantFromJwt(payload, activeCompanyIdCookie);
  if (tenant.needsCompany || !tenant.companyId) return false;
  if (tenant.companyPlan === "ENTERPRISE") return false;

  const mems = parseJwtMemberships(payload);
  const row = mems?.find((m) => m.companyId === tenant.companyId);
  if (!row) return false;

  const periodEndMs = subscriptionPeriodEndMs(row);
  if (periodEndMs != null && Date.now() < periodEndMs) {
    return false;
  }

  if (tenant.companyPlan === "PRO") {
    if (row.subscriptionPeriodEnd == null) return false;
    return Date.now() >= (periodEndMs ?? 0);
  }

  if (tenant.companyPlan !== "BASIC") return false;

  const trialIso = row.trialEndsAt;
  if (!trialIso) return false;
  const trialEndMs = Date.parse(trialIso);
  if (Number.isNaN(trialEndMs)) return false;
  if (Date.now() < trialEndMs) return false;
  return true;
}

/** @deprecated alias — use {@link jwtSaysSubscriptionExpired}. */
export function jwtSaysBasicTrialExpired(
  payload: Record<string, unknown>,
  activeCompanyIdCookie: string | undefined,
): boolean {
  return jwtSaysSubscriptionExpired(payload, activeCompanyIdCookie);
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Custom plan selected but Razorpay checkout not completed — block product APIs until payment.
 */
export function customPaymentPendingAllowsApiRequest(pathname: string, method: string): boolean {
  const p = normalizePathname(pathname);
  const m = method.toUpperCase();
  const allow: [string, string][] = [
    ["/api/auth/me", "GET"],
    ["/api/auth/logout", "POST"],
    ["/api/auth/refresh-session", "POST"],
    ["/api/payment/razorpay/order", "POST"],
    ["/api/payment/razorpay/verify", "POST"],
    ["/api/payment/razorpay/webhook", "POST"],
    ["/api/company/list", "GET"],
    ["/api/company/switch", "POST"],
    ["/api/onboarding/custom/status", "GET"],
    ["/api/onboarding/custom/submit", "POST"],
  ];
  if (allow.some(([path, mm]) => p === path && m === mm)) return true;
  if (m === "GET" && p.startsWith("/api/onboarding/custom/")) return true;
  return false;
}

/**
 * When subscription is expired at the edge: allow reads and a small mutation allowlist
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
    ["/api/payment/razorpay/order", "POST"],
    ["/api/payment/razorpay/verify", "POST"],
    ["/api/payment/razorpay/webhook", "POST"],
    ["/api/sales-booster/upgrade-request", "POST"],
    ["/api/company/switch", "POST"],
    ["/api/bgos/growth-plan", "PATCH"],
  ];
  return allow.some(([path, mm]) => p === path && m === mm);
}
