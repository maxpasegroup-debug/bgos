/**
 * Internal Nexa Behavior Engine  (id: bgos_nexa_behavior_v2)
 *
 * Tracks per-staff performance signals and generates short, direct, proactive
 * messages for the internal dashboard NexaTodayPanel.
 *
 * Rules:
 *   · inactivity > 1 day   → task reminder
 *   · performance low      → extra tasks assigned
 *   · close to target      → urgency nudge
 *
 * STRICT: No commission splits or internal math exposed in any message text.
 */

import type { PrismaClient } from "@prisma/client";
import { SalesNetworkRole } from "@prisma/client";
import {
  POINTS_SCALE,
  ISE_MILESTONE_POINTS_THRESHOLD,
  ISE_BDE_RECURRING_UNLOCK_SUBS,
  ISE_BDE_TO_BDM_ACTIVE_SUBS,
  ISE_BDM_TO_RSM_MIN_BDES,
  ISE_DIRECT_COMMISSION,
} from "@/config/internal-sales-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InternalNexaMessageType =
  | "task_reminder"
  | "performance"
  | "urgency"
  | "recognition";

export type InternalNexaMessage = {
  type: InternalNexaMessageType;
  /** Max 1 line micro-prompt, emoji at the end. */
  text: string;
  /** Short tap label. */
  cta: string;
  priority: number; // higher = shown first (1–100)
  /** Internal route the user is taken to when they tap this task. */
  action: string;
};

export type InternalBehaviorContext = {
  userId: string;
  firstName: string | null;
  role: SalesNetworkRole;
  inactivityDays: number;
  tasksCompletedToday: number;
  tasksCompletedMonth: number;
  displayPoints: number;          // storedPoints / POINTS_SCALE
  activeSubs: number;
  bdmDirectBdeCount: number;
};

export type InternalNexaResponse = {
  messages: InternalNexaMessage[];
  extraTasks: string[];           // assigned when performance is low
  inactivityDays: number;
  displayPoints: number;
  activeSubs: number;
  urgencyLevel: "calm" | "normal" | "high" | "critical";
};

// ---------------------------------------------------------------------------
// Message builder (pure — no DB)
// ---------------------------------------------------------------------------

export function buildInternalNexaMessages(
  ctx: InternalBehaviorContext,
): InternalNexaResponse {
  const name = ctx.firstName?.trim().split(/\s+/)[0] ?? null;

  const candidates: InternalNexaMessage[] = [];

  // --- Rule 1: inactivity → task reminder ---
  if (ctx.inactivityDays > 2) {
    candidates.push({
      type:     "task_reminder",
      text:     `${Math.floor(ctx.inactivityDays)}d offline — leads are waiting ⏰`,
      cta:      "Open leads",
      action:   "/internal/leads",
      priority: 95,
    });
  } else if (ctx.inactivityDays > 1) {
    candidates.push({
      type:     "task_reminder",
      text:     name ? `${name}, you've been away. Let's go 🔥` : "You've been away. Let's go 🔥",
      cta:      "Resume",
      action:   "/internal/leads",
      priority: 80,
    });
  }

  // --- Rule 2: performance low → calls nudge ---
  if (ctx.tasksCompletedToday === 0) {
    candidates.push({
      type:     "performance",
      text:     "Call 5 leads now ⚡",
      cta:      "View leads",
      action:   "/internal/leads",
      priority: 85,
    });
  } else if (ctx.tasksCompletedToday < 3) {
    candidates.push({
      type:     "performance",
      text:     `${ctx.tasksCompletedToday}/5 calls done today 🎯`,
      cta:      "Keep going",
      action:   "/internal/leads",
      priority: 65,
    });
  }

  // --- Rule 3a: close to ₹30K milestone ---
  const milestoneDisplay = ISE_MILESTONE_POINTS_THRESHOLD / POINTS_SCALE;
  const ptGap = milestoneDisplay - ctx.displayPoints;
  if (ctx.role === SalesNetworkRole.BDE && ptGap > 0 && ptGap <= 5) {
    candidates.push({
      type:     "urgency",
      text:     `You're ${ptGap} pt${ptGap === 1 ? "" : "s"} away from ₹30K 🔥`,
      cta:      "Close a deal",
      action:   "/internal/sales",
      priority: 90,
    });
  }

  // --- Rule 3b: close to recurring unlock ---
  if (ctx.role === SalesNetworkRole.BDE) {
    const recurringGap = ISE_BDE_RECURRING_UNLOCK_SUBS - ctx.activeSubs;
    if (recurringGap > 0 && recurringGap <= 3) {
      candidates.push({
        type:     "urgency",
        text:     `${recurringGap} more sub${recurringGap === 1 ? "" : "s"} = monthly bonus 💰`,
        cta:      "Onboard now",
        action:   "/internal/onboard-company",
        priority: 88,
      });
    }
  }

  // --- Rule 3c: close to BDM promotion ---
  if (ctx.role === SalesNetworkRole.BDE) {
    const bdmGap = ISE_BDE_TO_BDM_ACTIVE_SUBS - ctx.activeSubs;
    if (bdmGap > 0 && bdmGap <= 5) {
      candidates.push({
        type:     "urgency",
        text:     `${bdmGap} subs to BDM level — push now 🚀`,
        cta:      "Convert leads",
        action:   "/internal/leads",
        priority: 86,
      });
    }
  }

  // --- Rule 3d: BDM close to RSM ---
  if (ctx.role === SalesNetworkRole.BDM) {
    const rsmBdeGap = ISE_BDM_TO_RSM_MIN_BDES - ctx.bdmDirectBdeCount;
    if (rsmBdeGap > 0 && rsmBdeGap <= 2) {
      candidates.push({
        type:     "urgency",
        text:     `${rsmBdeGap} BDE${rsmBdeGap === 1 ? "" : "s"} from RSM 👑`,
        cta:      "Add BDE",
        action:   "/internal/team",
        priority: 82,
      });
    }
  }

  // --- Recognition: on track ---
  if (candidates.length === 0 && ctx.activeSubs > 0 && ctx.tasksCompletedToday >= 5) {
    candidates.push({
      type:     "recognition",
      text:     name ? `Strong session, ${name}. Keep it up 💪` : "Strong session. Keep it up 💪",
      cta:      "Dashboard",
      action:   "/internal/sales",
      priority: 20,
    });
  }

  // Sort by priority descending, cap at 3
  const messages = candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  // --- Extra tasks (performance low rule) ---
  const extraTasks: string[] = [];
  if (ctx.tasksCompletedToday < 3) {
    extraTasks.push("Call 5 leads from your active pipeline.");
    if (ctx.role === SalesNetworkRole.BDE && ctx.activeSubs < ISE_BDE_RECURRING_UNLOCK_SUBS) {
      extraTasks.push(`Follow up on ${Math.min(3, ctx.activeSubs + 1)} warm prospects.`);
    }
    if (ctx.role === SalesNetworkRole.BDM) {
      extraTasks.push("Review your team's follow-up log today.");
    }
    extraTasks.push("Log every customer interaction in the system.");
  }

  // --- Urgency level ---
  let urgencyLevel: InternalNexaResponse["urgencyLevel"] = "normal";
  if (ctx.inactivityDays > 2) urgencyLevel = "critical";
  else if (ctx.inactivityDays > 1 || ptGap <= 2) urgencyLevel = "high";
  else if (ctx.tasksCompletedToday >= 5 && ctx.activeSubs >= 15) urgencyLevel = "calm";

  return {
    messages,
    extraTasks,
    inactivityDays: ctx.inactivityDays,
    displayPoints: ctx.displayPoints,
    activeSubs: ctx.activeSubs,
    urgencyLevel,
  };
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/**
 * Called on every dashboard load. Updates lastLoginAt and recomputes
 * inactivityDays. Also resets tasksCompletedToday if the date has changed.
 */
export async function trackInternalLogin(
  prisma: PrismaClient,
  userId: string,
  companyId: string,
): Promise<void> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const existing = await prisma.internalNexaState.findUnique({
    where: { userId },
    select: { lastLoginAt: true, lastTaskResetDate: true },
  });

  const prevLogin = existing?.lastLoginAt ?? null;
  const inactivityDays = prevLogin
    ? (now.getTime() - prevLogin.getTime()) / 86_400_000
    : 0;

  const needsDailyReset = existing?.lastTaskResetDate !== todayStr;

  await prisma.internalNexaState.upsert({
    where: { userId },
    create: {
      userId,
      companyId,
      lastLoginAt: now,
      inactivityDays: 0,
      tasksCompletedToday: 0,
      tasksCompletedMonth: 0,
      lastTaskResetDate: todayStr,
    },
    update: {
      lastLoginAt: now,
      inactivityDays,
      ...(needsDailyReset ? { tasksCompletedToday: 0, lastTaskResetDate: todayStr } : {}),
    },
  });
}

/**
 * Increments the task completion counters. Call whenever a staff member
 * completes a call, onboards a company, or marks a task done.
 */
export async function trackInternalTaskComplete(
  prisma: PrismaClient,
  userId: string,
  companyId: string,
): Promise<void> {
  await prisma.internalNexaState.upsert({
    where: { userId },
    create: {
      userId,
      companyId,
      tasksCompletedToday: 1,
      tasksCompletedMonth: 1,
      lastTaskResetDate: new Date().toISOString().slice(0, 10),
    },
    update: {
      tasksCompletedToday: { increment: 1 },
      tasksCompletedMonth: { increment: 1 },
    },
  });
}

/**
 * Fetches all signals needed to run buildInternalNexaMessages.
 */
export async function getInternalBehaviorContext(
  prisma: PrismaClient,
  userId: string,
  companyId: string,
): Promise<InternalBehaviorContext | null> {
  const [membership, nexaState, userRecord] = await Promise.all([
    prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: {
        salesNetworkRole: true,
        totalPoints: true,
        activeSubscriptionsCount: true,
        parentUserId: true,
      },
    }),
    prisma.internalNexaState.findUnique({
      where: { userId },
      select: {
        inactivityDays: true,
        tasksCompletedToday: true,
        tasksCompletedMonth: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }),
  ]);

  if (!membership) return null;

  const role = membership.salesNetworkRole ?? SalesNetworkRole.BDE;

  // BDM: count direct BDEs
  let bdmDirectBdeCount = 0;
  if (role === SalesNetworkRole.BDM) {
    bdmDirectBdeCount = await prisma.userCompany.count({
      where: {
        companyId,
        parentUserId: userId,
        salesNetworkRole: SalesNetworkRole.BDE,
        archivedAt: null,
      },
    });
  }

  const firstName = userRecord?.name?.trim().split(/\s+/)[0] ?? null;

  return {
    userId,
    firstName,
    role,
    inactivityDays: nexaState?.inactivityDays ?? 0,
    tasksCompletedToday: nexaState?.tasksCompletedToday ?? 0,
    tasksCompletedMonth: nexaState?.tasksCompletedMonth ?? 0,
    displayPoints: Math.floor((membership.totalPoints ?? 0) / POINTS_SCALE),
    activeSubs: membership.activeSubscriptionsCount ?? 0,
    bdmDirectBdeCount,
  };
}
