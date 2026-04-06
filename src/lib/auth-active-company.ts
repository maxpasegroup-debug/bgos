/**
 * Active-company resolution for Edge (middleware). No Prisma / Node-only APIs.
 *
 * Subscription: `companyPlan` is taken from the JWT `memberships` entry for the
 * **active company** (`activeCompanyId` cookie), i.e. {@link Company.plan} as last
 * minted into the token (login / switch / `POST /api/auth/refresh-session`). It is
 * not a property of the user record.
 */

export type JwtMembership = {
  companyId: string;
  plan: "BASIC" | "PRO";
  jobRole: string;
};

export function parseJwtMemberships(payload: Record<string, unknown>): JwtMembership[] | null {
  const raw = payload.memberships;
  if (!Array.isArray(raw)) return null;
  const out: JwtMembership[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const companyId = o.companyId;
    const plan = o.plan === "PRO" ? "PRO" : "BASIC";
    const jobRole = typeof o.jobRole === "string" ? o.jobRole : "";
    if (typeof companyId !== "string" || !companyId || !jobRole) continue;
    out.push({ companyId, plan, jobRole });
  }
  return out.length ? out : null;
}

export function resolveTenantFromJwt(
  payload: Record<string, unknown>,
  activeCompanyIdCookie: string | undefined,
): {
  needsCompany: boolean;
  companyId: string | null;
  companyPlan: "BASIC" | "PRO";
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
  const companyPlan = row
    ? row.plan
    : payload.companyPlan === "PRO"
      ? "PRO"
      : "BASIC";
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
