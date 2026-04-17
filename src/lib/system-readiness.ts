import { resolveTenantFromJwt } from "@/lib/auth-active-company";

/**
 * Strict workspace gate (Edge-safe): JWT must carry `workspaceReady: true`
 * minted from DB (`User.workspaceActivatedAt`), plus company + role.
 */
export function isSystemReadyFromJwtPayload(
  payload: Record<string, unknown>,
  activeCompanyIdCookie?: string | null,
): boolean {
  const sub = typeof payload.sub === "string" && payload.sub.length > 0;
  const email = typeof payload.email === "string" && payload.email.length > 0;
  if (!sub || !email) return false;
  if (payload.workspaceReady !== true) return false;
  const t = resolveTenantFromJwt(payload, activeCompanyIdCookie ?? undefined);
  if (t.needsCompany || !t.companyId) return false;
  const role = String(t.jobRole || (typeof payload.role === "string" ? payload.role : "") || "").trim();
  return role.length > 0;
}

export const BGOS_BOSS_READY_HOME = "/bgos/control/home" as const;
export const BGOS_ONBOARDING_ENTRY = "/onboarding/nexa" as const;
