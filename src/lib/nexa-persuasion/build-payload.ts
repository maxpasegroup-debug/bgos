import { SalesNetworkRole, type PrismaClient } from "@prisma/client";
import {
  BDE_TO_BDM_ACTIVE_SUBS,
  BDM_TO_RSM_MIN_BDES,
  PLAN_SALE_VALUE_INR,
} from "@/config/sales-hierarchy";
import { computeCompetitionProgress } from "@/lib/nexa-ceo/competition-progress";
import { nexaAddress } from "@/lib/nexa-voice/framework";
import { computeActivityStreakDays, computeSalesStreakDays } from "@/lib/nexa-persuasion/streaks";
import { getTimeBandIst, timingHint, type NexaTimeBand } from "@/lib/nexa-persuasion/timing";
import { computeSalesRank, maxWinsTodayInCompany } from "@/lib/nexa-persuasion/social";
import { loadPersuasionState, resolveMicroWin } from "@/lib/nexa-persuasion/micro-wins";

export const NEXA_PERSUASION_VERSION = "1" as const;

export type NexaProgressBlock = {
  label: string;
  current: number;
  next_milestone: number;
  gap: number;
  unit: string;
  display: string;
};

export type NexaPersuasionPayload = {
  version: typeof NEXA_PERSUASION_VERSION;
  time_band: NexaTimeBand;
  timing_hint: string;
  progress: NexaProgressBlock | null;
  urgency: string | null;
  loss_aversion: string | null;
  social_proof: string | null;
  micro_win: string | null;
  streak: { activity_days: number; sales_days: number; line: string | null };
  reward_anticipation: string | null;
  smart_nudge: string | null;
  role_focus: string | null;
  addiction_loop: string;
};

const LOOP = "Action → Reward → Progress → Next goal.";

function roleFocus(
  snr: SalesNetworkRole | null,
  addr: string,
  band: NexaTimeBand,
): string | null {
  if (snr === SalesNetworkRole.BDE || snr === null) {
    if (band === "morning") return `${addr}Plan calls and earnings targets first.`;
    if (band === "afternoon") return `${addr}Push volume on qualified leads. Protect follow-up time.`;
    return `${addr}Review what moved. Lock tomorrow’s first three dials.`;
  }
  if (snr === SalesNetworkRole.BDM) {
    if (band === "morning") return `${addr}Set one team standard for the day.`;
    if (band === "afternoon") return `${addr}Inspect BDE pipelines. Remove blockers.`;
    return `${addr}Score the team on execution quality, not effort.`;
  }
  if (snr === SalesNetworkRole.RSM) {
    return `${addr}Own regional variance. Correct the weakest BDM this week.`;
  }
  return null;
}

export async function buildPersuasionPayload(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
  firstName: string | null,
  salesNetworkRole: SalesNetworkRole | null,
  metrics: {
    hotCount: number;
    mediumCount: number;
    inactiveHours: number | null;
    bdmDirectBdeCount: number;
    totalPoints: number;
    region: string | null;
    activeSubs: number;
  },
): Promise<NexaPersuasionPayload> {
  const addr = nexaAddress(firstName);
  const band = getTimeBandIst();
  const timing_hint = timingHint(band);

  const activeSubs = metrics.activeSubs;
  const [activityStreak, salesStreak, rankInfo, topWinsToday, persState] = await Promise.all([
    computeActivityStreakDays(prisma, companyId, userId),
    computeSalesStreakDays(prisma, companyId, userId),
    computeSalesRank(prisma, companyId, userId),
    maxWinsTodayInCompany(prisma, companyId),
    loadPersuasionState(prisma, companyId, userId),
  ]);

  const micro = await resolveMicroWin(prisma, companyId, userId, firstName, persState);

  let progress: NexaProgressBlock | null = null;
  if (salesNetworkRole === SalesNetworkRole.BDE || salesNetworkRole === null) {
    const gap = Math.max(0, BDE_TO_BDM_ACTIVE_SUBS - activeSubs);
    const notional = metrics.totalPoints * (PLAN_SALE_VALUE_INR.BASIC / 100);
    const inrGap = Math.max(0, 30000 - notional);
    progress = {
      label: "BDM unlock",
      current: activeSubs,
      next_milestone: BDE_TO_BDM_ACTIVE_SUBS,
      gap,
      unit: "active sales",
      display:
        gap === 0
          ? `${addr}BDM threshold is met on subscriptions. Confirm promotion steps with your manager.`
          : `${addr}You are ${gap} active sale${gap === 1 ? "" : "s"} from the BDM threshold. Roughly ₹${Math.round(inrGap).toLocaleString("en-IN")} notional gap on points value.`,
    };
  } else if (salesNetworkRole === SalesNetworkRole.BDM) {
    const team = metrics.bdmDirectBdeCount;
    const gap = Math.max(0, BDM_TO_RSM_MIN_BDES - team);
    progress = {
      label: "RSM readiness",
      current: team,
      next_milestone: BDM_TO_RSM_MIN_BDES,
      gap,
      unit: "strong BDEs",
      display:
        gap === 0
          ? `${addr}Bench depth meets RSM signal. Formalize succession planning.`
          : `${addr}You need ${gap} more strong BDE${gap === 1 ? "" : "s"} for RSM readiness.`,
    };
  } else if (salesNetworkRole === SalesNetworkRole.RSM && metrics.region) {
    progress = {
      label: "Regional cadence",
      current: metrics.totalPoints,
      next_milestone: metrics.totalPoints,
      gap: 0,
      unit: "network points",
      display: `${addr}Region ${metrics.region} rolls up to your forecast. Align BDMs on one weekly revenue target.`,
    };
  }

  let urgency: string | null = null;
  if (salesNetworkRole === SalesNetworkRole.BDE || salesNetworkRole === null) {
    const gap = Math.max(0, BDE_TO_BDM_ACTIVE_SUBS - activeSubs);
    if (gap > 0 && gap <= 3 && (band === "afternoon" || band === "evening")) {
      urgency = `${addr}Push today. You can close the gap on your milestone before the day ends.`;
    } else if (gap > 0 && gap <= 5 && band === "morning") {
      urgency = `${addr}The window is open. Five or fewer sales stand between you and the next tier.`;
    }
  }

  let loss_aversion: string | null = null;
  if (metrics.inactiveHours != null && metrics.inactiveHours >= 6 && metrics.hotCount > 0) {
    const n = Math.min(metrics.hotCount, 3);
    loss_aversion = `${addr}Inaction today risks ${n} late-stage conversation${n === 1 ? "" : "s"} cooling.`;
  }

  const socialParts: string[] = [];
  if (rankInfo && rankInfo.peerCount > 1) {
    const topQ = Math.max(1, Math.ceil(rankInfo.peerCount * 0.25));
    if (rankInfo.rank > topQ) {
      socialParts.push(
        `You are ranked #${rankInfo.rank} of ${rankInfo.peerCount} on points. Top ${topQ} pull ahead weekly.`,
      );
    } else {
      socialParts.push(`You are ranked #${rankInfo.rank} of ${rankInfo.peerCount}. Hold the standard.`);
    }
  }
  if (topWinsToday > 0) {
    socialParts.push(
      `Top performers in your company closed ${topWinsToday} deal${topWinsToday === 1 ? "" : "s"} today.`,
    );
  }
  const social_proof = socialParts.length > 0 ? socialParts.join(" ") : null;

  let streakLine: string | null = null;
  if (activityStreak >= 2) {
    streakLine = `You are on a ${activityStreak}-day activity streak. Do not break it.`;
  }
  if (salesStreak >= 2) {
    streakLine = streakLine
      ? `${streakLine} Sales streak: ${salesStreak} day${salesStreak === 1 ? "" : "s"}.`
      : `${salesStreak}-day sales streak. Keep the rhythm.`;
  }

  let reward_anticipation: string | null = null;
  const comp = await prisma.nexaCompetition.findFirst({
    where: { companyId, endDate: { gte: new Date() }, startDate: { lte: new Date() } },
    orderBy: { endDate: "asc" },
  });
  if (comp) {
    const prog = await computeCompetitionProgress(prisma, companyId, userId, comp);
    const left = Math.max(0, comp.targetValue - prog);
    const rewardShort = comp.reward.length > 72 ? `${comp.reward.slice(0, 72)}…` : comp.reward;
    reward_anticipation =
      left === 0
        ? `Competition "${comp.title}": target met. Defend rank before close.`
        : `Competition "${comp.title}": ${left} remaining toward target. Reward: ${rewardShort}.`;
  }

  let smart_nudge: string | null = null;
  if (metrics.inactiveHours != null && metrics.inactiveHours > 6) {
    smart_nudge = `${addr}No CRM motion in hours. Start with your three highest-probability leads.`;
  } else if (metrics.hotCount + metrics.mediumCount === 0) {
    smart_nudge = `${addr}Pipeline is thin. Add two qualified leads before you stop.`;
  }

  return {
    version: NEXA_PERSUASION_VERSION,
    time_band: band,
    timing_hint,
    progress,
    urgency,
    loss_aversion,
    social_proof,
    micro_win: micro?.text ?? null,
    streak: { activity_days: activityStreak, sales_days: salesStreak, line: streakLine },
    reward_anticipation,
    smart_nudge,
    role_focus: roleFocus(salesNetworkRole, addr, band),
    addiction_loop: LOOP,
  };
}
