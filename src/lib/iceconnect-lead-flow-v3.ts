import { IceconnectMetroStage, type OnboardingSubmissionStatus, type OnboardingTechTaskStatus } from "@prisma/client";

export type LeadFlowV3Stage =
  | "NEW"
  | "INTRODUCED"
  | "DEMO"
  | "FOLLOW_UP"
  | "ONBOARD"
  | "SUBSCRIPTION";

export type LeadFlowV3Selection = LeadFlowV3Stage | "LOST";

export const LEAD_FLOW_V3_LABEL: Record<LeadFlowV3Stage, string> = {
  NEW: "New",
  INTRODUCED: "Introduced",
  DEMO: "Demo",
  FOLLOW_UP: "Follow Up",
  ONBOARD: "Onboard",
  SUBSCRIPTION: "Subscription",
};

export function flowV3StageFromDb(stage: IceconnectMetroStage | null | undefined): LeadFlowV3Stage {
  if (stage === IceconnectMetroStage.INTRO_CALL) return "INTRODUCED";
  if (stage === IceconnectMetroStage.DEMO_DONE) return "DEMO";
  if (stage === IceconnectMetroStage.FOLLOW_UP) return "FOLLOW_UP";
  if (stage === IceconnectMetroStage.ONBOARDING || stage === IceconnectMetroStage.PAYMENT_DONE) {
    return "ONBOARD";
  }
  if (stage === IceconnectMetroStage.SUBSCRIPTION) return "SUBSCRIPTION";
  return "NEW";
}

export function flowV3StageToDb(stage: LeadFlowV3Stage): IceconnectMetroStage {
  if (stage === "INTRODUCED") return IceconnectMetroStage.INTRO_CALL;
  if (stage === "DEMO") return IceconnectMetroStage.DEMO_DONE;
  if (stage === "FOLLOW_UP") return IceconnectMetroStage.FOLLOW_UP;
  if (stage === "ONBOARD") return IceconnectMetroStage.ONBOARDING;
  if (stage === "SUBSCRIPTION") return IceconnectMetroStage.SUBSCRIPTION;
  return IceconnectMetroStage.LEAD_CREATED;
}

export function onboardingFormStatusLabel(status: OnboardingSubmissionStatus | null | undefined): string {
  if (!status) return "Not started";
  if (status === "DRAFT") return "In progress";
  if (status === "SUBMITTED") return "Submitted";
  return "Under review";
}

export function techStatusLabel(status: OnboardingTechTaskStatus | null | undefined): string | null {
  if (!status) return null;
  if (status === "DELIVERED" || status === "READY") return "Completed";
  if (status === "IN_PROGRESS") return "In Progress";
  return "Pending";
}

