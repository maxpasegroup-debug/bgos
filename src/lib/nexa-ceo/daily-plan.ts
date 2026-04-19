import {
  NexaCoachingActionType,
  NexaCoachingPriority,
  SalesNetworkRole,
  TaskStatus,
} from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { getActiveSubscriptionCount } from "@/lib/sales-hierarchy/active-subscriptions";
import { resolveNexaMode } from "@/lib/nexa-ceo/nexa-mode";
import {
  NEXA_COLD_LEAD_STATUSES,
  NEXA_HOT_LEAD_STATUSES,
  NEXA_MEDIUM_LEAD_STATUSES,
} from "@/lib/nexa-ceo/lead-tiers";
import { buildDailyNexaVoice } from "@/lib/nexa-voice/daily-messages";
import { NEXA_VOICE_VERSION } from "@/lib/nexa-voice/personality";
import type { NexaStructuredMessage } from "@/lib/nexa-voice/framework";
import { resolveNexaToneProfile } from "@/lib/nexa-voice/tone";
import type { NexaToneProfile } from "@/lib/nexa-voice/tone";
import { buildPersuasionPayload } from "@/lib/nexa-persuasion/build-payload";
import type { NexaPersuasionPayload } from "@/lib/nexa-persuasion/build-payload";

export type UrgencyLevel = "calm" | "normal" | "high" | "critical";

export type DailyPlanResult = {
  ok: true;
  nexa_mode: "coach" | "manager" | "ceo";
  tone_profile: NexaToneProfile;
  voice_version: typeof NEXA_VOICE_VERSION;
  nexa_messages: NexaStructuredMessage[];
  tasks: string[];
  insights: string[];
  urgency_level: UrgencyLevel;
  promotion_nudges: string[];
  performance_triggers: string[];
  persuasion: NexaPersuasionPayload;
};

function hoursSince(d: Date | null): number | null {
  if (!d) return null;
  return (Date.now() - d.getTime()) / 36e5;
}

export async function buildDailyPlan(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
  isPlatformBoss: boolean,
  firstName: string | null,
): Promise<DailyPlanResult> {
  const membership = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: {
      salesNetworkRole: true,
      totalPoints: true,
      activeSubscriptionsCount: true,
      region: true,
    },
  });

  const snr = membership?.salesNetworkRole ?? null;
  const nexa_mode = resolveNexaMode(snr, isPlatformBoss);
  const tone_profile = resolveNexaToneProfile(snr, nexa_mode);

  const [hotCount, mediumCount, coldCount, lastActivity, pendingTasks, activeSubs, bdmDirectBdeCount] =
    await Promise.all([
      prisma.lead.count({
        where: {
          companyId,
          assignedTo: userId,
          status: { in: NEXA_HOT_LEAD_STATUSES },
        },
      }),
      prisma.lead.count({
        where: {
          companyId,
          assignedTo: userId,
          status: { in: NEXA_MEDIUM_LEAD_STATUSES },
        },
      }),
      prisma.lead.count({
        where: {
          companyId,
          assignedTo: userId,
          status: { in: NEXA_COLD_LEAD_STATUSES },
        },
      }),
      prisma.activityLog.findFirst({
        where: { companyId, userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.task.count({
        where: {
          companyId,
          userId,
          status: TaskStatus.PENDING,
          dueDate: { lte: new Date() },
        },
      }),
      getActiveSubscriptionCount(prisma, companyId, userId),
      snr === SalesNetworkRole.BDM
        ? prisma.userCompany.count({
            where: {
              companyId,
              parentUserId: userId,
              salesNetworkRole: SalesNetworkRole.BDE,
              archivedAt: null,
            },
          })
        : Promise.resolve(0),
    ]);

  const inactiveH = hoursSince(lastActivity?.createdAt ?? null);

  const voice = buildDailyNexaVoice({
    firstName,
    salesNetworkRole: snr,
    nexaMode: nexa_mode,
    region: membership?.region ?? null,
    totalPoints: membership?.totalPoints ?? 0,
    hotCount,
    mediumCount,
    coldCount,
    inactiveHours: inactiveH,
    pendingTasks,
    activeSubs,
    bdmDirectBdeCount,
  });

  const persuasion = await buildPersuasionPayload(prisma, companyId, userId, firstName, snr, {
    hotCount,
    mediumCount,
    inactiveHours: inactiveH,
    bdmDirectBdeCount,
    totalPoints: membership?.totalPoints ?? 0,
    region: membership?.region ?? null,
    activeSubs,
  });

  let urgency_level: UrgencyLevel = "normal";
  if (inactiveH != null && inactiveH >= 10 && hotCount > 0) urgency_level = "critical";
  else if (hotCount >= 5 || pendingTasks >= 5) urgency_level = "high";
  else if (inactiveH != null && inactiveH >= 6) urgency_level = "high";
  else if (coldCount > 20 && hotCount === 0) urgency_level = "calm";

  return {
    ok: true,
    nexa_mode,
    tone_profile,
    voice_version: NEXA_VOICE_VERSION,
    nexa_messages: voice.messages,
    tasks: voice.tasks,
    insights: voice.insight_lines,
    urgency_level,
    promotion_nudges: voice.promotion_lines,
    performance_triggers: voice.performance_lines,
    persuasion,
  };
}

export async function ensureDailyCoachingTouch(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
  roleLabel: string,
  summary: string,
): Promise<void> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const existing = await prisma.nexaCoachingLog.count({
    where: { companyId, userId, createdAt: { gte: start } },
  });
  if (existing > 0) return;

  await prisma.nexaCoachingLog.create({
    data: {
      companyId,
      userId,
      role: roleLabel.slice(0, 48),
      message: summary.slice(0, 2000),
      actionType: NexaCoachingActionType.TRAIN,
      priority: NexaCoachingPriority.MEDIUM,
    },
  });
}
