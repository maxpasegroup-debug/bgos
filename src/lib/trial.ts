import "server-only";

import { CompanyPlan } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
};

/**
 * BASIC companies with a trial end set are blocked after `trialEndDate` (inclusive of the instant).
 * `trialEndDate == null` → legacy company (no trial enforcement).
 */
export function isBasicTrialExpired(company: CompanyTrialFields): boolean {
  if (company.plan !== CompanyPlan.BASIC) return false;
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

export async function isCompanyBasicTrialExpired(companyId: string): Promise<boolean> {
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true, trialEndDate: true },
  });
  if (!c) return false;
  return isBasicTrialExpired(c);
}
