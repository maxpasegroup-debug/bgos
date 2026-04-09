import { CompanyPlan } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { jsonSuccess, jsonError } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncCompanySubscriptionStatus, trialDaysRemaining } from "@/lib/subscription-status";

function planDisplayName(plan: CompanyPlan): string {
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
 * Active-company subscription summary for `/bgos/subscription`. Syncs `subscriptionStatus` from wall-clock trial.
 */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  if (!session.companyId) {
    return jsonError(400, "NEEDS_COMPANY", "Create a company to view subscription.");
  }

  const companyId = session.companyId;
  const status = await syncCompanySubscriptionStatus(companyId);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      plan: true,
      trialEndDate: true,
      subscriptionStatus: true,
    },
  });

  if (!company) {
    return jsonError(404, "NOT_FOUND", "Company not found.");
  }

  const trialEndsAt = company.trialEndDate?.toISOString() ?? null;
  const daysLeft = trialDaysRemaining(company.trialEndDate);

  let renewalDate: string | null = null;
  if (company.plan === CompanyPlan.BASIC && company.trialEndDate) {
    renewalDate = trialEndsAt;
  }

  return jsonSuccess({
    companyName: company.name,
    planType: company.plan,
    planName: planDisplayName(company.plan),
    subscriptionStatus: status,
    trialEndsAt,
    trialDaysRemaining: daysLeft,
    renewalDate,
  });
}
