import "server-only";

import { CompanyPlan } from "@prisma/client";
import { NextResponse } from "next/server";
import type { AuthUser } from "./auth";
import { jwtCompanyPlanFromUnknown, type JwtCompanyPlan } from "./plan-tier";
import { isPlanLockedToBasic } from "./plan-production-lock";
import { prisma } from "./prisma";

export function isBasic(plan: CompanyPlan): boolean {
  return plan === CompanyPlan.BASIC;
}

/** Pro product line: PRO and ENTERPRISE both qualify. */
export function isPro(plan: CompanyPlan): boolean {
  return plan === CompanyPlan.PRO || plan === CompanyPlan.ENTERPRISE;
}

export function isEnterprise(plan: CompanyPlan): boolean {
  return plan === CompanyPlan.ENTERPRISE;
}

export function companyPlanToJwt(plan: CompanyPlan): JwtCompanyPlan {
  if (plan === CompanyPlan.ENTERPRISE) return "ENTERPRISE";
  if (plan === CompanyPlan.PRO) return "PRO";
  return "BASIC";
}

export function companyPlanFromJwtString(raw: unknown): CompanyPlan {
  const t = jwtCompanyPlanFromUnknown(raw);
  if (t === "ENTERPRISE") return CompanyPlan.ENTERPRISE;
  if (t === "PRO") return CompanyPlan.PRO;
  return CompanyPlan.BASIC;
}

export function userHasProPlan(user: AuthUser): boolean {
  return isPro(user.companyPlan);
}

export function userHasEnterprisePlan(user: AuthUser): boolean {
  return isEnterprise(user.companyPlan);
}

export function proPlanRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      ok: false as const,
      error: "This feature requires a Pro plan",
      code: "PLAN_PRO_REQUIRED",
    },
    { status: 403 },
  );
}

export function enterprisePlanRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      ok: false as const,
      error: "This feature requires an Enterprise plan",
      code: "PLAN_ENTERPRISE_REQUIRED",
    },
    { status: 403 },
  );
}

/** Returns a 403 response if the user is not on Pro+; otherwise `null`. */
export function requireProPlan(user: AuthUser): NextResponse | null {
  if (!userHasProPlan(user)) return proPlanRequiredResponse();
  return null;
}

/** Returns a 403 response if the user is not on Enterprise; otherwise `null`. */
export function requireEnterprisePlan(user: AuthUser): NextResponse | null {
  if (!userHasEnterprisePlan(user)) return enterprisePlanRequiredResponse();
  return null;
}

/**
 * JWT says Pro+ and {@link Company.plan} is Pro+ in the DB. Use after middleware so
 * downgrades apply even if the session token has not been refreshed yet.
 */
export async function requireLiveProPlan(user: AuthUser): Promise<NextResponse | null> {
  if (!user.companyId) return proPlanRequiredResponse();
  if (isPlanLockedToBasic()) return proPlanRequiredResponse();
  const jwt = requireProPlan(user);
  if (jwt) return jwt;
  const row = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { plan: true },
  });
  if (!row || !isPro(row.plan)) {
    return proPlanRequiredResponse();
  }
  return null;
}

/** Live DB check for Enterprise-only surfaces. */
export async function requireLiveEnterprisePlan(user: AuthUser): Promise<NextResponse | null> {
  if (!user.companyId) return enterprisePlanRequiredResponse();
  if (isPlanLockedToBasic()) return enterprisePlanRequiredResponse();
  const jwt = requireEnterprisePlan(user);
  if (jwt) return jwt;
  const row = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { plan: true },
  });
  if (!row || !isEnterprise(row.plan)) {
    return enterprisePlanRequiredResponse();
  }
  return null;
}
