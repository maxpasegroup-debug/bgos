import "server-only";

import { CompanySubscriptionStatus, CompanyPlan } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCompanySubscriptionStatus } from "@/lib/subscription-status";

import { TRIAL_EXPIRED_API_MESSAGE } from "@/lib/trial-middleware";

/** User-facing copy (API route handlers; middleware uses the same string from `trial-middleware`). */
export const TRIAL_EXPIRED_MESSAGE = TRIAL_EXPIRED_API_MESSAGE;

export const TRIAL_EXPIRED_CODE = "TRIAL_EXPIRED" as const;

/** Fifteen full 24h days from company creation instant (accurate wall-clock). */
export const TRIAL_DURATION_MS = 15 * 24 * 60 * 60 * 1000;

export function trialEndDateFromStart(trialStartDate: Date): Date {
  return new Date(trialStartDate.getTime() + TRIAL_DURATION_MS);
}

export type CompanyTrialFields = {
  plan: CompanyPlan;
  trialEndDate: Date | null;
  subscriptionPeriodEnd?: Date | null;
};

/**
 * BASIC companies with a trial end set are blocked after `trialEndDate` unless a paid period is active.
 */
export function isBasicTrialExpired(company: CompanyTrialFields): boolean {
  if (company.plan !== CompanyPlan.BASIC) return false;
  if (company.subscriptionPeriodEnd && Date.now() < company.subscriptionPeriodEnd.getTime()) {
    return false;
  }
  if (!company.trialEndDate) return false;
  return Date.now() >= company.trialEndDate.getTime();
}

export function trialExpiredJsonResponse(): NextResponse {
  return NextResponse.json(
    {
      ok: false as const,
      error: TRIAL_EXPIRED_MESSAGE,
      code: TRIAL_EXPIRED_CODE,
    },
    { status: 403 },
  );
}

/**
 * True when the workspace should be read-only / blocked for mutations (Basic trial ended, Pro period ended, etc.).
 */
export async function isCompanyBasicTrialExpired(companyId: string): Promise<boolean> {
  const status = await syncCompanySubscriptionStatus(companyId);
  return status === CompanySubscriptionStatus.EXPIRED;
}
