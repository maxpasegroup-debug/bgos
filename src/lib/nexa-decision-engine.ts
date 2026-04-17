import { CompanySubscriptionStatus } from "@prisma/client";

export type NexaUserState = "NEW" | "TRAINING" | "ACTIVE" | "GROWING" | "AT_RISK";
export type NexaDecisionPriority = "HIGH" | "MEDIUM" | "LOW";
export type NexaDecisionMode = "Neutral" | "Guiding" | "Motivating" | "Conversion";

export type NexaDecisionInput = {
  now: Date;
  leadsCount: number;
  newLeadsStuck2d: number;
  onboardingWeekCount: number;
  onboardingMonthCount: number;
  hasSubscription: boolean;
  ownerLastLoginDays: number | null;
  inactiveEmployees2d: number;
  activeSubscriptions: number;
  pendingPayments: number;
  growthTrendPercent: number;
};

export type NexaDecisionRule = {
  id: string;
  priority: NexaDecisionPriority;
  condition: (input: NexaDecisionInput) => boolean;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  mode: NexaDecisionMode;
};

export type NexaDecisionAction = {
  id: string;
  priority: NexaDecisionPriority;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  mode: NexaDecisionMode;
};

export type NexaDecisionResult = {
  userState: NexaUserState;
  actions: NexaDecisionAction[];
  dailyNudge: string;
  weeklyNudge: string | null;
  monthlyNudge: string | null;
};

const PRIORITY_WEIGHT: Record<NexaDecisionPriority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

export const defaultDecisionRules: NexaDecisionRule[] = [
  {
    id: "NO_LEADS",
    priority: "HIGH",
    condition: (i) => i.leadsCount === 0,
    message: "Add your first 5 leads. Start with your contacts.",
    ctaLabel: "Add Leads",
    ctaHref: "/iceconnect/leads",
    mode: "Guiding",
  },
  {
    id: "LEADS_NOT_MOVING",
    priority: "MEDIUM",
    condition: (i) => i.newLeadsStuck2d > 0,
    message: "Follow up your leads today.",
    ctaLabel: "Open Leads",
    ctaHref: "/iceconnect/leads",
    mode: "Guiding",
  },
  {
    id: "LOW_ONBOARDING",
    priority: "MEDIUM",
    condition: (i) => i.onboardingWeekCount < 3,
    message: "You're close. Onboard 2 more companies.",
    ctaLabel: "Start Onboarding",
    ctaHref: "/onboarding/nexa?source=sales",
    mode: "Motivating",
  },
  {
    id: "TEAM_INACTIVE",
    priority: "HIGH",
    condition: (i) => i.inactiveEmployees2d > 0,
    message: "Your team is inactive. Ask them to log in.",
    ctaLabel: "Open Team",
    ctaHref: "/iceconnect/manager",
    mode: "Guiding",
  },
  {
    id: "READY_FOR_UPGRADE",
    priority: "LOW",
    condition: (i) => i.onboardingWeekCount >= 3 && !i.hasSubscription,
    message: "You're ready to scale. Upgrade to Pro.",
    ctaLabel: "Upgrade",
    ctaHref: "/iceconnect/pro",
    mode: "Conversion",
  },
  {
    id: "PENDING_PAYMENTS",
    priority: "HIGH",
    condition: (i) => i.pendingPayments > 0,
    message: "Clear pending payments today.",
    ctaLabel: "Open Wallet",
    ctaHref: "/iceconnect/wallet",
    mode: "Guiding",
  },
];

function hoursSinceStartOfDay(now: Date): number {
  return now.getHours();
}

function buildDailyNudge(now: Date): string {
  const h = hoursSinceStartOfDay(now);
  if (h < 12) return "Start your day. Add 3 leads.";
  if (h < 18) return "Follow up pending leads.";
  return "You're close to your target. Close strong.";
}

function buildWeeklyNudge(input: NexaDecisionInput): string | null {
  if (input.now.getDay() !== 1) return null;
  return `You onboarded ${input.onboardingWeekCount} companies. Let's reach 10.`;
}

function buildMonthlyNudge(input: NexaDecisionInput): string | null {
  const statusActive = input.hasSubscription || input.activeSubscriptions > 0;
  if (statusActive && input.onboardingMonthCount < 10) {
    const remaining = 10 - input.onboardingMonthCount;
    return `You need ${remaining} more onboardings to stay active.`;
  }
  return null;
}

export function deriveUserState(input: NexaDecisionInput): NexaUserState {
  if (input.leadsCount === 0 && input.onboardingWeekCount === 0) return "NEW";
  if (input.onboardingWeekCount < 3) return "TRAINING";
  if (input.inactiveEmployees2d > 0 || (input.ownerLastLoginDays ?? 0) > 2) return "AT_RISK";
  if (input.growthTrendPercent >= 12) return "GROWING";
  return "ACTIVE";
}

export function runNexaDecisionEngine(
  input: NexaDecisionInput,
  rules: NexaDecisionRule[] = defaultDecisionRules,
): NexaDecisionResult {
  const actions = rules
    .filter((r) => r.condition(input))
    .sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
    .slice(0, 2)
    .map((r) => ({
      id: r.id,
      priority: r.priority,
      message: r.message,
      ctaLabel: r.ctaLabel,
      ctaHref: r.ctaHref,
      mode: r.mode,
    }));

  return {
    userState: deriveUserState(input),
    actions,
    dailyNudge: buildDailyNudge(input.now),
    weeklyNudge: buildWeeklyNudge(input),
    monthlyNudge: buildMonthlyNudge(input),
  };
}

export function companyHasSubscription(status: CompanySubscriptionStatus | null | undefined): boolean {
  return status === CompanySubscriptionStatus.ACTIVE || status === CompanySubscriptionStatus.TRIAL;
}
