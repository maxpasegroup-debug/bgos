import { InternalSalesStage, InternalTechStage } from "@prisma/client";

/** Sales metro — ordered; advance one step at a time. */
export const SALES_METRO_STAGES: {
  key: InternalSalesStage;
  label: string;
}[] = [
  { key: InternalSalesStage.LEAD_ADDED, label: "Lead Added" },
  { key: InternalSalesStage.INTRO_CALL, label: "Intro Call" },
  { key: InternalSalesStage.DEMO_ORIENTATION, label: "Demo / Orientation" },
  { key: InternalSalesStage.FOLLOW_UP, label: "Follow-up" },
  { key: InternalSalesStage.INTERESTED, label: "Interested" },
  { key: InternalSalesStage.ONBOARDING_FORM_FILLED, label: "Onboarding Form Filled" },
  { key: InternalSalesStage.SENT_TO_TECH, label: "Sent to Tech" },
  { key: InternalSalesStage.TECH_READY, label: "Tech Ready" },
  { key: InternalSalesStage.DELIVERED, label: "Delivered" },
  { key: InternalSalesStage.CLIENT_LIVE, label: "Client Live" },
];

export const TECH_METRO_STAGES: {
  key: InternalTechStage;
  label: string;
}[] = [
  { key: InternalTechStage.ONBOARDING_RECEIVED, label: "Onboarding Received" },
  { key: InternalTechStage.DATA_VERIFIED, label: "Data Verified" },
  { key: InternalTechStage.DASHBOARD_SETUP, label: "Dashboard Setup" },
  { key: InternalTechStage.EMPLOYEE_SETUP, label: "Employee Setup" },
  { key: InternalTechStage.SYSTEM_TESTING, label: "System Testing" },
  { key: InternalTechStage.READY_FOR_DELIVERY, label: "Ready for Delivery" },
];

export function salesMetroIndex(stage: InternalSalesStage): number {
  return SALES_METRO_STAGES.findIndex((s) => s.key === stage);
}

export function techMetroIndex(stage: InternalTechStage): number {
  return TECH_METRO_STAGES.findIndex((s) => s.key === stage);
}

export function defaultSalesStage(): InternalSalesStage {
  return InternalSalesStage.LEAD_ADDED;
}

/** Next sales stage if current is completed (linear). CLOSED_LOST excluded. */
export function nextSalesStage(current: InternalSalesStage): InternalSalesStage | null {
  if (current === InternalSalesStage.CLOSED_LOST) return null;
  const i = salesMetroIndex(current);
  if (i < 0 || i >= SALES_METRO_STAGES.length - 1) return null;
  return SALES_METRO_STAGES[i + 1]!.key;
}

export function canJumpSalesStage(from: InternalSalesStage, to: InternalSalesStage): boolean {
  if (from === InternalSalesStage.CLOSED_LOST || to === InternalSalesStage.CLOSED_LOST) {
    return true;
  }
  if (
    from === InternalSalesStage.INTERESTED &&
    to === InternalSalesStage.ONBOARDING_FORM_FILLED
  ) {
    return false;
  }
  if (
    from === InternalSalesStage.ONBOARDING_FORM_FILLED &&
    to === InternalSalesStage.SENT_TO_TECH
  ) {
    return false;
  }
  if (
    from === InternalSalesStage.SENT_TO_TECH &&
    to === InternalSalesStage.TECH_READY
  ) {
    return false;
  }
  const iFrom = salesMetroIndex(from);
  const iTo = salesMetroIndex(to);
  if (iFrom < 0 || iTo < 0) return false;
  return iTo === iFrom + 1;
}

export function nextTechStage(current: InternalTechStage): InternalTechStage | null {
  const i = techMetroIndex(current);
  if (i < 0 || i >= TECH_METRO_STAGES.length - 1) return null;
  return TECH_METRO_STAGES[i + 1]!.key;
}

export function canJumpTechStage(from: InternalTechStage, to: InternalTechStage): boolean {
  const iFrom = techMetroIndex(from);
  const iTo = techMetroIndex(to);
  if (iFrom < 0 || iTo < 0) return false;
  return iTo === iFrom + 1;
}

export function salesMetroLabel(stage: InternalSalesStage): string {
  if (stage === InternalSalesStage.CLOSED_LOST) return "Closed Lost";
  if (stage === InternalSalesStage.BOSS_APPROVAL_PENDING) return "Boss Approval";
  return SALES_METRO_STAGES.find((s) => s.key === stage)?.label ?? stage;
}

export function techMetroLabel(stage: InternalTechStage): string {
  return TECH_METRO_STAGES.find((s) => s.key === stage)?.label ?? stage;
}

export function initialTechStage(): InternalTechStage {
  return InternalTechStage.ONBOARDING_RECEIVED;
}

