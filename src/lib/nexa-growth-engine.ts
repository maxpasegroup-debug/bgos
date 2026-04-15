import "server-only";

export type GrowthState = "BEGINNER" | "ACTIVE" | "GROWING" | "TOP_PERFORMER";

export type GrowthTargets = {
  dailyLeads: number;
  weeklyOnboarding: number;
  monthlyOnboarding: number;
};

export type GrowthMetrics = {
  leadsAddedToday: number;
  leadsConverted: number;
  onboardingCountWeek: number;
  onboardingCountMonth: number;
  revenueThisMonth: number;
  conversionRate: number;
};

export type GrowthAction = {
  id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  ctaLabel: string;
  ctaHref: string;
};

export type FunnelSnapshot = {
  leads: number;
  demo: number;
  followUp: number;
  onboarding: number;
  subscription: number;
};

export type GrowthEngineOutput = {
  targets: GrowthTargets;
  metrics: GrowthMetrics;
  funnel: FunnelSnapshot;
  actions: GrowthAction[];
  growthState: GrowthState;
  dailyLoop: string;
  streakDays: number;
  weeklyScore: number;
  monthlyLevel: number;
};

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

export const DEFAULT_GROWTH_TARGETS: GrowthTargets = {
  dailyLeads: 5,
  weeklyOnboarding: 5,
  monthlyOnboarding: 10,
};

export function detectGrowthState(metrics: GrowthMetrics): GrowthState {
  if (metrics.onboardingCountMonth >= 12 && metrics.conversionRate >= 35) return "TOP_PERFORMER";
  if (metrics.onboardingCountWeek >= 5 || metrics.conversionRate >= 25) return "GROWING";
  if (metrics.leadsAddedToday >= 3 || metrics.onboardingCountWeek >= 2) return "ACTIVE";
  return "BEGINNER";
}

export function buildDailyLoop(now: Date, remainingDailyLeads: number): string {
  const hour = now.getHours();
  if (hour < 12) return "Start your day. Add 5 leads.";
  if (hour < 18) return "Follow up your leads.";
  return `You are ${Math.max(0, remainingDailyLeads)} away from your goal.`;
}

export function buildGrowthActions(input: {
  metrics: GrowthMetrics;
  targets: GrowthTargets;
  funnel: FunnelSnapshot;
  hasClientsWithoutSubscription: boolean;
}): GrowthAction[] {
  const out: GrowthAction[] = [];
  const { metrics, targets, funnel } = input;

  if (metrics.leadsAddedToday === 0) {
    out.push({
      id: "NO_LEADS",
      priority: "HIGH",
      message: "Add 5 leads now.",
      ctaLabel: "Add Leads",
      ctaHref: "/iceconnect/leads",
    });
  } else if (metrics.leadsAddedToday < targets.dailyLeads) {
    out.push({
      id: "LEAD_GAP",
      priority: "MEDIUM",
      message: `Add ${targets.dailyLeads - metrics.leadsAddedToday} more leads today.`,
      ctaLabel: "Add Leads",
      ctaHref: "/iceconnect/leads",
    });
  }

  if (metrics.conversionRate < 20) {
    out.push({
      id: "LOW_CONVERSION",
      priority: "HIGH",
      message: "Focus on follow-ups to improve conversion.",
      ctaLabel: "Open Leads",
      ctaHref: "/iceconnect/leads",
    });
  }

  if (metrics.onboardingCountWeek < targets.weeklyOnboarding) {
    out.push({
      id: "WEEKLY_ONBOARDING_GAP",
      priority: "MEDIUM",
      message: `You need ${targets.weeklyOnboarding - metrics.onboardingCountWeek} more onboardings this week.`,
      ctaLabel: "Start Onboarding",
      ctaHref: "/iceconnect/onboarding",
    });
  }

  if (funnel.demo > 0 && funnel.followUp === 0) {
    out.push({
      id: "DEMO_DROP",
      priority: "MEDIUM",
      message: "Leads are not converting after demo.",
      ctaLabel: "Call Leads",
      ctaHref: "/iceconnect/leads",
    });
  }

  if (input.hasClientsWithoutSubscription) {
    out.push({
      id: "REVENUE_PUSH",
      priority: "LOW",
      message: "Upgrade 2 clients to Pro today.",
      ctaLabel: "Open Subscription",
      ctaHref: "/iceconnect/pro",
    });
  }

  return out
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    .slice(0, 3);
}

export function buildGrowthOutput(input: {
  now: Date;
  metrics: GrowthMetrics;
  targets: GrowthTargets;
  funnel: FunnelSnapshot;
  streakDays: number;
  hasClientsWithoutSubscription: boolean;
}): GrowthEngineOutput {
  const growthState = detectGrowthState(input.metrics);
  const dailyRemaining = input.targets.dailyLeads - input.metrics.leadsAddedToday;
  const dailyLoop = buildDailyLoop(input.now, dailyRemaining);
  const actions = buildGrowthActions({
    metrics: input.metrics,
    targets: input.targets,
    funnel: input.funnel,
    hasClientsWithoutSubscription: input.hasClientsWithoutSubscription,
  });
  const weeklyScore =
    input.metrics.leadsAddedToday * 5 +
    input.metrics.onboardingCountWeek * 12 +
    Math.round(input.metrics.conversionRate);
  const monthlyLevel = Math.max(1, Math.floor(input.metrics.onboardingCountMonth / 3) + 1);

  return {
    targets: input.targets,
    metrics: input.metrics,
    funnel: input.funnel,
    actions,
    growthState,
    dailyLoop,
    streakDays: input.streakDays,
    weeklyScore,
    monthlyLevel,
  };
}
