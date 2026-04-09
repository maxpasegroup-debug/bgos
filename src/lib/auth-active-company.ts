/**
 * Active-company resolution for Edge (middleware). No Prisma / Node-only APIs.
 *
 * Subscription: `companyPlan` is taken from the JWT `memberships` entry for the
 * **active company** (`activeCompanyId` cookie), i.e. {@link Company.plan} as last
 * minted into the token (login / switch / `POST /api/auth/refresh-session`). It is
 * not a property of the user record.
 */

import { jwtCompanyPlanFromUnknown, type JwtCompanyPlan } from "./plan-tier";

export type JwtMembership = {
  companyId: string;
  plan: JwtCompanyPlan;
  jobRole: string;
  /** ISO 8601; when set for BASIC, middleware compares to `Date.now()` for expiry. */
  trialEndsAt: string | null;
  /** ISO 8601 end of paid Razorpay/Stripe period; when future, trial/billing gates stay open. */
  subscriptionPeriodEnd: string | null;
};

export function parseJwtMemberships(payload: Record<string, unknown>): JwtMembership[] | null {
  const raw = payload.memberships;
  if (!Array.isArray(raw)) return null;
  const out: JwtMembership[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const companyId = o.companyId;
    const plan = jwtCompanyPlanFromUnknown(o.plan);
    const jobRole = typeof o.jobRole === "string" ? o.jobRole : "";
    if (typeof companyId !== "string" || !companyId || !jobRole) continue;
    const te = o.trialEndsAt;
    const trialEndsAt =
      typeof te === "string" && te.trim() ? te.trim() : null;
    const spe = o.subscriptionPeriodEnd;
    const subscriptionPeriodEnd =
      typeof spe === "string" && spe.trim() ? spe.trim() : null;
    out.push({ companyId, plan, jobRole, trialEndsAt, subscriptionPeriodEnd });
  }
  return out.length ? out : null;
}

export function resolveTenantFromJwt(
  payload: Record<string, unknown>,
  activeCompanyIdCookie: string | undefined,
): {
  needsCompany: boolean;
  companyId: string | null;
  companyPlan: JwtCompanyPlan;
  jobRole: string;
  workspaceReady: boolean;
} {
  const workspaceReady = payload.workspaceReady !== false;
  const jwtCompanyId =
    typeof payload.companyId === "string" && payload.companyId.length > 0
      ? payload.companyId
      : null;
  const memberships = parseJwtMemberships(payload);

  if (!jwtCompanyId && (!memberships || memberships.length === 0)) {
    return {
      needsCompany: true,
      companyId: null,
      companyPlan: "BASIC",
      jobRole: typeof payload.role === "string" ? payload.role : "",
      workspaceReady,
    };
  }

  const ids = memberships?.map((m) => m.companyId) ?? (jwtCompanyId ? [jwtCompanyId] : []);
  if (ids.length === 0) {
    return {
      needsCompany: true,
      companyId: null,
      companyPlan: "BASIC",
      jobRole: typeof payload.role === "string" ? payload.role : "",
      workspaceReady,
    };
  }

  let chosen: string;
  if (activeCompanyIdCookie && ids.includes(activeCompanyIdCookie)) {
    chosen = activeCompanyIdCookie;
  } else if (jwtCompanyId && ids.includes(jwtCompanyId)) {
    chosen = jwtCompanyId;
  } else {
    chosen = ids[0]!;
  }

  const row = memberships?.find((m) => m.companyId === chosen);
  const companyPlan = row ? row.plan : jwtCompanyPlanFromUnknown(payload.companyPlan);
  const jobRole =
    row?.jobRole ?? (typeof payload.role === "string" ? payload.role : "ADMIN");

  return {
    needsCompany: false,
    companyId: chosen,
    companyPlan,
    jobRole,
    workspaceReady,
  };
}
