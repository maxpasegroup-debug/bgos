import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CompanyPlan } from "@prisma/client";
import { jsonSuccess } from "@/lib/api-response";
import { resolveTenantFromJwt } from "@/lib/auth-active-company";
import { ACTIVE_COMPANY_COOKIE_NAME, AUTH_COOKIE_NAME } from "@/lib/auth-config";
import { getMeSessionFromToken } from "@/lib/auth";
import { verifyAccessTokenResult } from "@/lib/jwt";
import { isPlanLockedToBasic } from "@/lib/plan-production-lock";
import { prisma } from "@/lib/prisma";
import { syncCompanySubscriptionStatus, trialDaysRemaining } from "@/lib/subscription-status";
import { isCompanyBasicTrialExpired } from "@/lib/trial";
import { isBgosProductionBossBypassEmail } from "@/lib/bgos-production-boss-bypass";
import { jwtSaysSubscriptionExpired } from "@/lib/trial-middleware";
import { isSuperBossEmail } from "@/lib/super-boss";

function planLabel(plan: CompanyPlan): string {
  switch (plan) {
    case CompanyPlan.BASIC:
      return "Basic";
    case CompanyPlan.PRO:
      return "Pro";
    case CompanyPlan.ENTERPRISE:
      return "Enterprise";
    default:
      return plan;
  }
}

/**
 * Current session (cookie JWT). No cookie → `authenticated: false` (200).
 * Bad or expired token → 401 with `TOKEN_EXPIRED` / `TOKEN_INVALID`.
 */
export async function GET() {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE_NAME)?.value;
  const activeCompanyIdCookie = jar.get(ACTIVE_COMPANY_COOKIE_NAME)?.value ?? null;
  const session = getMeSessionFromToken(token);

  switch (session.status) {
    case "none":
      return jsonSuccess({
        authenticated: false as const,
      });
    case "expired":
      return NextResponse.json(
        {
          ok: false as const,
          authenticated: false as const,
          code: "TOKEN_EXPIRED" as const,
          error: "Session expired — please sign in again",
        },
        { status: 401 },
      );
    case "invalid":
      return NextResponse.json(
        {
          ok: false as const,
          authenticated: false as const,
          code: "TOKEN_INVALID" as const,
          error: "Invalid or expired session",
        },
        { status: 401 },
      );
    case "valid": {
      const bossBillingBypass = isBgosProductionBossBypassEmail(session.user.email);
      let basicTrialExpired = false;
      let companyName: string | null = null;
      let billing:
        | {
            plan: CompanyPlan;
            planLabel: string;
            subscriptionStatus: string;
            trialDaysRemaining: number | null;
            renewalDateIso: string | null;
          }
        | undefined;

      if (token) {
        const vr = verifyAccessTokenResult(token);
        if (vr.ok) {
          const payload = vr.payload as Record<string, unknown>;
          const tenant = resolveTenantFromJwt(payload, activeCompanyIdCookie ?? undefined);
          if (!tenant.needsCompany && tenant.companyId) {
            if (bossBillingBypass) {
              basicTrialExpired = false;
              await syncCompanySubscriptionStatus(tenant.companyId);
              const co = await prisma.company.findUnique({
                where: { id: tenant.companyId },
                select: {
                  name: true,
                  plan: true,
                  subscriptionStatus: true,
                  trialEndDate: true,
                  subscriptionPeriodEnd: true,
                },
              });
              companyName = co?.name ?? null;
              billing = {
                plan: CompanyPlan.PRO,
                planLabel: planLabel(CompanyPlan.PRO),
                subscriptionStatus: "ACTIVE",
                trialDaysRemaining: null,
                renewalDateIso: null,
              };
            } else {
              const jwtExp = jwtSaysSubscriptionExpired(
                payload,
                activeCompanyIdCookie ?? undefined,
              );
              const dbExp = await isCompanyBasicTrialExpired(
                tenant.companyId,
                session.user.email,
              );
              basicTrialExpired = jwtExp || dbExp;
              await syncCompanySubscriptionStatus(tenant.companyId);
              const co = await prisma.company.findUnique({
                where: { id: tenant.companyId },
                select: {
                  name: true,
                  plan: true,
                  subscriptionStatus: true,
                  trialEndDate: true,
                  subscriptionPeriodEnd: true,
                },
              });
              companyName = co?.name ?? null;
              if (co) {
                billing = {
                  plan: co.plan,
                  planLabel: planLabel(co.plan),
                  subscriptionStatus: co.subscriptionStatus,
                  trialDaysRemaining: trialDaysRemaining(co.trialEndDate),
                  renewalDateIso:
                    co.subscriptionPeriodEnd?.toISOString() ??
                    co.trialEndDate?.toISOString() ??
                    null,
                };
              }
            }
          }
        }
      }

      const u = await prisma.user.findUnique({
        where: { id: session.user.sub },
        select: { name: true },
      });
      let jwtSuperBoss = false;
      if (token) {
        const vr = verifyAccessTokenResult(token);
        if (vr.ok) {
          jwtSuperBoss = (vr.payload as Record<string, unknown>).superBoss === true;
        }
      }
      const isSuperBoss =
        jwtSuperBoss === true && isSuperBossEmail(session.user.email) === true;
      return jsonSuccess({
        authenticated: true as const,
        planLockedToBasic: bossBillingBypass ? false : isPlanLockedToBasic(),
        basicTrialExpired: bossBillingBypass ? false : basicTrialExpired,
        ...(bossBillingBypass ? { bossBillingBypass: true as const } : {}),
        ...(billing ? { billing } : {}),
        user: {
          id: session.user.sub,
          name: u?.name ?? "",
          email: session.user.email,
          role: session.user.role,
          companyId: session.user.companyId,
          companyName,
          companyPlan: bossBillingBypass ? CompanyPlan.PRO : session.user.companyPlan,
          needsOnboarding: session.user.companyId === null,
          workspaceReady: session.user.workspaceReady,
          needsWorkspaceActivation:
            session.user.companyId !== null && !session.user.workspaceReady,
          activeCompanyIdCookie,
          memberships: session.user.memberships ?? null,
          isSuperBoss,
        },
      });
    }
  }
}
