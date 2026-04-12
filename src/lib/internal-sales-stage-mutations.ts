import "server-only";

import {
  InternalOnboardingApprovalStatus,
  InternalSalesStage,
  InternalTechStage,
} from "@prisma/client";
import {
  canJumpSalesStage,
  defaultSalesStage,
  initialTechStage,
  nextSalesStage,
  nextTechStage,
} from "@/lib/internal-sales-metro";
import type { AuthUserWithCompany } from "@/lib/auth";

export type LeadStageRow = {
  id: string;
  internalSalesStage: InternalSalesStage | null;
  internalOnboardingApprovalStatus: InternalOnboardingApprovalStatus | null;
  internalTechStage: InternalTechStage | null;
};

export type StageMutationError = { code: string; message: string };

/**
 * Validates moving `internalSalesStage` to `target` (single-step or CLOSED_LOST, or boss/tech exceptions).
 */
export function validateSalesStageChange(
  session: AuthUserWithCompany,
  lead: LeadStageRow,
  target: InternalSalesStage,
): StageMutationError | null {
  const from = lead.internalSalesStage ?? defaultSalesStage();

  if (target === InternalSalesStage.CLOSED_LOST) {
    return null;
  }

  if (from === InternalSalesStage.CLOSED_LOST) {
    return { code: "PIPELINE_CLOSED", message: "Lead is closed lost" };
  }

  if (from === InternalSalesStage.INTERESTED) {
    return {
      code: "USE_ONBOARDING_FORM",
      message: "Complete the onboarding form to move past Interested",
    };
  }

  if (
    from === InternalSalesStage.ONBOARDING_FORM_FILLED &&
    lead.internalOnboardingApprovalStatus === InternalOnboardingApprovalStatus.PENDING
  ) {
    return {
      code: "BOSS_APPROVAL_REQUIRED",
      message: "Waiting for boss approval",
    };
  }

  if (from === InternalSalesStage.SENT_TO_TECH) {
    return { code: "WAIT_TECH", message: "Tech completes setup and hands over when ready" };
  }

  if (!canJumpSalesStage(from, target)) {
    return { code: "INVALID_STAGE_STEP", message: "Complete the current stage first (no skipping)" };
  }

  return null;
}

/** After tech marks ready for delivery, sales sets TECH_READY (via this check from SENT_TO_TECH). */
export function validateTechReadyAdvance(lead: LeadStageRow): StageMutationError | null {
  const from = lead.internalSalesStage ?? defaultSalesStage();
  if (from !== InternalSalesStage.SENT_TO_TECH) {
    return { code: "INVALID_STAGE", message: "Lead must be Sent to Tech" };
  }
  if (lead.internalTechStage !== InternalTechStage.READY_FOR_DELIVERY) {
    return { code: "TECH_NOT_READY", message: "Tech must complete Ready for Delivery first" };
  }
  return null;
}

export function expectedNextSalesStage(lead: LeadStageRow): InternalSalesStage | null {
  return nextSalesStage(lead.internalSalesStage ?? defaultSalesStage());
}

export function expectedNextTechStage(lead: LeadStageRow): InternalTechStage | null {
  const t = lead.internalTechStage ?? initialTechStage();
  return nextTechStage(t);
}

/** Next sales stage for “Complete stage” — skips blocks handled elsewhere (form, boss, tech). */
export function resolveAdvanceSalesStage(lead: LeadStageRow): InternalSalesStage | null {
  const from = lead.internalSalesStage ?? defaultSalesStage();
  if (from === InternalSalesStage.CLOSED_LOST) return null;
  if (from === InternalSalesStage.INTERESTED) return null;
  if (from === InternalSalesStage.ONBOARDING_FORM_FILLED) return null;
  if (from === InternalSalesStage.SENT_TO_TECH) return null;
  return nextSalesStage(from);
}
