import { IceconnectMetroStage, type OnboardingSubmissionStatus, type OnboardingTechTaskStatus } from "@prisma/client";

export type LeadFlowV3Stage =
  | "NEW"
  | "INTRODUCTION"
  | "LIVE_DEMO"
  | "CREATE_ACCOUNT"
  | "ONBOARDING"
  | "LIVE";

export type LeadFlowV3Selection = LeadFlowV3Stage | "LOST";

export const LEAD_FLOW_V3_LABEL: Record<LeadFlowV3Stage, string> = {
  NEW: "New",
  INTRODUCTION: "Introduction",
  LIVE_DEMO: "Live Demo",
  CREATE_ACCOUNT: "Create Account",
  ONBOARDING: "Onboarding",
  LIVE: "Live",
};

export function flowV3StageFromDb(stage: IceconnectMetroStage | null | undefined): LeadFlowV3Stage {
  if (stage === IceconnectMetroStage.INTRO_CALL) return "INTRODUCTION";
  if (stage === IceconnectMetroStage.DEMO_DONE) return "LIVE_DEMO";
  if (stage === IceconnectMetroStage.FOLLOW_UP) return "CREATE_ACCOUNT";
  if (stage === IceconnectMetroStage.ONBOARDING || stage === IceconnectMetroStage.PAYMENT_DONE) {
    return "ONBOARDING";
  }
  if (stage === IceconnectMetroStage.SUBSCRIPTION) return "LIVE";
  return "NEW";
}

export function flowV3StageToDb(stage: LeadFlowV3Stage): IceconnectMetroStage {
  if (stage === "INTRODUCTION") return IceconnectMetroStage.INTRO_CALL;
  if (stage === "LIVE_DEMO") return IceconnectMetroStage.DEMO_DONE;
  if (stage === "CREATE_ACCOUNT") return IceconnectMetroStage.FOLLOW_UP;
  if (stage === "ONBOARDING") return IceconnectMetroStage.ONBOARDING;
  if (stage === "LIVE") return IceconnectMetroStage.SUBSCRIPTION;
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

