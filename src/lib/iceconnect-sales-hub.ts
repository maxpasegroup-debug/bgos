import {
  IceconnectCustomerPlan,
  IceconnectMetroStage,
  TaskStatus,
} from "@prisma/client";

export const METRO_STAGES: readonly IceconnectMetroStage[] = [
  IceconnectMetroStage.LEAD_CREATED,
  IceconnectMetroStage.INTRO_CALL,
  IceconnectMetroStage.DEMO_DONE,
  IceconnectMetroStage.FOLLOW_UP,
  IceconnectMetroStage.ONBOARDING,
  IceconnectMetroStage.SUBSCRIPTION,
] as const;

export const METRO_STAGE_LABEL: Record<IceconnectMetroStage, string> = {
  [IceconnectMetroStage.LEAD_CREATED]: "Lead Created",
  [IceconnectMetroStage.INTRO_CALL]: "Intro Call",
  [IceconnectMetroStage.DEMO_DONE]: "Demo Done",
  [IceconnectMetroStage.FOLLOW_UP]: "Follow-up",
  [IceconnectMetroStage.ONBOARDING]: "Onboarding",
  [IceconnectMetroStage.SUBSCRIPTION]: "Subscription",
};

export const CUSTOMER_PLAN_LABEL: Record<IceconnectCustomerPlan, string> = {
  [IceconnectCustomerPlan.FREE]: "Free",
  [IceconnectCustomerPlan.BASIC]: "Basic",
  [IceconnectCustomerPlan.PRO]: "Pro",
  [IceconnectCustomerPlan.ENTERPRISE]: "Enterprise",
};

export function nextMetroStage(
  current: IceconnectMetroStage | null | undefined,
): IceconnectMetroStage | null {
  const effective = current ?? IceconnectMetroStage.LEAD_CREATED;
  const i = METRO_STAGES.indexOf(effective);
  if (i < 0) return IceconnectMetroStage.INTRO_CALL;
  if (i >= METRO_STAGES.length - 1) return null;
  return METRO_STAGES[i + 1] ?? null;
}

export function monthBoundsUTC(year: number, month1to12: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month1to12, 0, 23, 59, 59, 999));
  return { start, end };
}

export function currentPeriod(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function eligibleSalaryRupees(
  achieved: number,
  targetCount: number,
  salaryRupees: number,
): { eligible: number; progressPct: number; cappedAchieved: number } {
  if (targetCount <= 0 || salaryRupees <= 0) {
    return { eligible: 0, progressPct: 0, cappedAchieved: achieved };
  }
  const ratio = Math.min(1, achieved / targetCount);
  return {
    eligible: Math.round(ratio * salaryRupees),
    progressPct: Math.round(ratio * 100),
    cappedAchieved: Math.min(achieved, targetCount),
  };
}

const DEMO_AND_BEYOND: IceconnectMetroStage[] = [
  IceconnectMetroStage.DEMO_DONE,
  IceconnectMetroStage.FOLLOW_UP,
  IceconnectMetroStage.ONBOARDING,
  IceconnectMetroStage.SUBSCRIPTION,
];

export function isDemoOrBeyond(stage: IceconnectMetroStage | null | undefined): boolean {
  if (stage == null) return false;
  return DEMO_AND_BEYOND.includes(stage);
}

export { TaskStatus };
