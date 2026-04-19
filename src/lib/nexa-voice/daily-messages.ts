import { SalesNetworkRole } from "@prisma/client";
import {
  BDE_TO_BDM_ACTIVE_SUBS,
  BDM_TO_RSM_MIN_BDES,
  PLAN_SALE_VALUE_INR,
} from "@/config/sales-hierarchy";
import type { NexaMode } from "@/lib/nexa-ceo/nexa-mode";
import { resolveNexaToneProfile } from "@/lib/nexa-voice/tone";
import { nexaAddress, nexaMessage, type NexaStructuredMessage } from "@/lib/nexa-voice/framework";
import { prioritizeNexaSessionMessages } from "@/lib/nexa-voice/prioritize";

export type DailyMetrics = {
  firstName: string | null;
  salesNetworkRole: SalesNetworkRole | null;
  nexaMode: NexaMode;
  region: string | null;
  totalPoints: number;
  hotCount: number;
  mediumCount: number;
  coldCount: number;
  inactiveHours: number | null;
  pendingTasks: number;
  activeSubs: number;
  bdmDirectBdeCount: number;
};

function milestoneGapInr(totalPoints: number): number {
  const notional = totalPoints * (PLAN_SALE_VALUE_INR.BASIC / 100);
  return Math.max(0, 30000 - notional);
}

/**
 * Builds all candidate Nexa messages for the daily plan, then caps for the session.
 */
export function buildDailyNexaVoice(
  m: DailyMetrics,
): {
  messages: NexaStructuredMessage[];
  tasks: string[];
  promotion_lines: string[];
  performance_lines: string[];
  insight_lines: string[];
} {
  const addr = nexaAddress(m.firstName);
  const tone = resolveNexaToneProfile(m.salesNetworkRole, m.nexaMode);
  const candidates: NexaStructuredMessage[] = [];

  const openPipeline = m.hotCount + m.mediumCount + m.coldCount;
  candidates.push(
    nexaMessage("coaching", {
      context: `${addr}You have ${openPipeline} active lead${openPipeline === 1 ? "" : "s"} in your name.`,
      insight:
        m.hotCount > 0
          ? `${m.hotCount} require direct outreach today.`
          : "None are in late stage until you advance them.",
      action:
        m.hotCount > 0
          ? `Call the hottest ${Math.min(m.hotCount, 5)} before end of day.`
          : `Add two qualified opportunities and move one stage forward.`,
    }),
  );

  if (m.hotCount >= 2) {
    candidates.push(
      nexaMessage("opportunity", {
        context: `${addr}${m.hotCount} leads show strong close potential.`,
        insight: "Probability is on your side if you shorten cycle time.",
        action: "Call within the hour. Send a firm next step after each call.",
      }),
    );
  }

  const gap = milestoneGapInr(m.totalPoints);
  if (gap > 0 && gap < 50000 && (m.salesNetworkRole === SalesNetworkRole.BDE || m.salesNetworkRole === null)) {
    const remaining = Math.max(0, BDE_TO_BDM_ACTIVE_SUBS - m.activeSubs);
    if (remaining > 0 && remaining <= 12) {
      candidates.push(
        nexaMessage("opportunity", {
          context: `${addr}You are ${remaining} active sale${remaining === 1 ? "" : "s"} from the BDM threshold.`,
          insight: `Milestone gap is roughly ₹${Math.round(gap).toLocaleString("en-IN")} on current pace.`,
          action: "Close one more subscription this week. Protect follow-up discipline.",
        }),
      );
    }
  }

  if (m.salesNetworkRole === SalesNetworkRole.BDE || m.salesNetworkRole === null) {
    const remaining = Math.max(0, BDE_TO_BDM_ACTIVE_SUBS - m.activeSubs);
    if (remaining > 12) {
      candidates.push(
        nexaMessage("coaching", {
          context: `${addr}Active subscriptions: ${m.activeSubs} of ${BDE_TO_BDM_ACTIVE_SUBS}.`,
          insight: "The BDM path unlocks recurring upside.",
          action: "Book three customer conversations this week. Log every outcome.",
        }),
      );
    }
  }

  if (m.salesNetworkRole === SalesNetworkRole.BDM) {
    candidates.push(
      nexaMessage("strategy", {
        context: `${addr}Your network lives or dies on follow-up quality.`,
        insight:
          m.mediumCount > 5 && m.hotCount === 0
            ? "Team conversion is softening at mid-funnel."
            : "Keep BDE activity aligned to one weekly revenue target.",
        action: "Review BDE follow-ups today. Remove single points of failure.",
      }),
    );
    const need = Math.max(0, BDM_TO_RSM_MIN_BDES - m.bdmDirectBdeCount);
    if (need > 0) {
      candidates.push(
        nexaMessage("strategy", {
          context: `${addr}RSM readiness depends on bench strength.`,
          insight: `You need ${need} more high-performing BDE${need === 1 ? "" : "s"} on target.`,
          action: "Run one coaching session and set non-negotiable activity minimums.",
        }),
      );
    }
  }

  if (m.salesNetworkRole === SalesNetworkRole.RSM && m.region) {
    candidates.push(
      nexaMessage("strategy", {
        context: `${addr}Region ${m.region} rolls up to your forecast.`,
        insight: "Misaligned BDM cadence shows up as revenue drift within weeks.",
        action: "Hold a short corrective sync with the weakest BDM this week.",
      }),
    );
  }

  if (m.inactiveHours != null && m.inactiveHours >= 8) {
    candidates.push(
      nexaMessage(m.inactiveHours >= 10 && m.hotCount > 0 ? "warning" : "alert", {
        context: `${addr}No CRM activity logged for several hours.`,
        insight: m.hotCount > 0 ? "Idle time burns hot opportunities." : "Pipeline goes stale without motion.",
        action:
          m.hotCount > 0
            ? "Start with your three highest-value leads now."
            : "Create one new qualified touchpoint before you log off.",
      }),
    );
  }

  if (m.pendingTasks > 0) {
    candidates.push(
      nexaMessage("alert", {
        context: `${addr}You have ${m.pendingTasks} overdue task${m.pendingTasks === 1 ? "" : "s"}.`,
        insight: "Missed tasks correlate with lost deals in the same week.",
        action: "Clear the oldest item first. Delegate if you are blocked.",
      }),
    );
  }

  if (m.hotCount === 0 && m.mediumCount > 5) {
    candidates.push(
      nexaMessage("alert", {
        context: `${addr}Warm pipeline is ${m.mediumCount} leads deep with nothing in late stage.`,
        insight: "Conversion risk rises when nurture runs long.",
        action: "Run your objection playbook on three accounts today.",
      }),
    );
  }

  if (tone === "bde" && m.activeSubs >= BDE_TO_BDM_ACTIVE_SUBS - 1) {
    candidates.push(
      nexaMessage("recognition", {
        context: `${addr}Subscription count is at executive level.`,
        insight: "You are inside the promotion window.",
        action: "Document wins. Ask your BDM for the next formal review.",
      }),
    );
  }

  const messages = prioritizeNexaSessionMessages(candidates);

  const tasks: string[] = [];
  if (m.hotCount > 0) tasks.push(`Call ${Math.min(m.hotCount, 8)} late-stage lead${m.hotCount === 1 ? "" : "s"}.`);
  if (m.mediumCount > 0)
    tasks.push(`Follow up ${Math.min(m.mediumCount, 6)} mid-funnel account${m.mediumCount === 1 ? "" : "s"}.`);
  if (m.pendingTasks > 0) tasks.push(`Close ${m.pendingTasks} overdue task${m.pendingTasks === 1 ? "" : "s"}.`);
  if (tasks.length === 0) {
    tasks.push("Add two qualified leads.");
    tasks.push("Move one deal one stage forward.");
    tasks.push("Log every customer touch in CRM.");
  } else if (tasks.length < 3) {
    tasks.push("Log outcomes immediately after each call.");
  }

  const promotion_lines: string[] = [];
  const performance_lines: string[] = [];
  const insight_lines: string[] = [];

  for (const msg of messages) {
    if (msg.kind === "opportunity" || msg.kind === "recognition") promotion_lines.push(msg.text);
    else if (msg.kind === "alert" || msg.kind === "warning") performance_lines.push(msg.text);
    else insight_lines.push(msg.text);
  }

  return {
    messages,
    tasks: tasks.slice(0, 5),
    promotion_lines: promotion_lines.slice(0, 3),
    performance_lines: performance_lines.slice(0, 3),
    insight_lines: insight_lines.slice(0, 4),
  };
}
