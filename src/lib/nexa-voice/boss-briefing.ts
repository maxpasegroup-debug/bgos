import { nexaMessage, type NexaStructuredMessage } from "@/lib/nexa-voice/framework";
import { prioritizeNexaSessionMessages } from "@/lib/nexa-voice/prioritize";

export type BossBriefingInput = {
  revenueToday: number;
  activeDeals: number;
  teamPerformancePct: number;
  riskCount: number;
  openTaskCount: number;
  companyCount: number;
};

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/**
 * CEO-style daily briefing: revenue, performance, risk, opportunity, action.
 */
export function buildBossBriefingVoice(input: BossBriefingInput): {
  messages: NexaStructuredMessage[];
  executive_summary: string;
} {
  const rev = formatInr(input.revenueToday);
  const candidates: NexaStructuredMessage[] = [];

  candidates.push(
    nexaMessage("strategy", {
      context: `Platform revenue today is ${rev}.`,
      insight: `${input.activeDeals} active deals are open across tenants.`,
      action:
        input.riskCount > 0
          ? `${input.riskCount} risk signal${input.riskCount === 1 ? "" : "s"} need executive review today.`
          : "No critical revenue risks flagged at this snapshot.",
    }),
  );

  candidates.push(
    nexaMessage("strategy", {
      context: `Composite team performance index is ${input.teamPerformancePct}%.`,
      insight:
        input.teamPerformancePct >= 70
          ? "Execution is within target band."
          : "Execution is below the executive comfort band.",
      action: "Direct managers to close follow-up gaps before week end.",
    }),
  );

  if (input.openTaskCount > 0) {
    candidates.push(
      nexaMessage("alert", {
        context: `${input.openTaskCount} Nexa task${input.openTaskCount === 1 ? "" : "s"} remain open or in progress.`,
        insight: "Task debt compounds into customer delay.",
        action: "Clear or delegate every item older than forty-eight hours.",
      }),
    );
  }

  if (input.companyCount === 0) {
    candidates.push(
      nexaMessage("warning", {
        context: "No companies are onboarded on the platform.",
        insight: "Revenue scale requires tenant depth.",
        action: "Prioritize one qualified launch this week.",
      }),
    );
  }

  if (input.activeDeals > 50) {
    candidates.push(
      nexaMessage("opportunity", {
        context: `${input.activeDeals} deals require attention at portfolio level.`,
        insight: "Volume is an advantage if response time stays tight.",
        action: "Assign regional owners. Track SLA breaches daily.",
      }),
    );
  }

  const messages = prioritizeNexaSessionMessages(candidates);
  const executive_summary = messages.map((m) => m.text).join(" ");

  return { messages, executive_summary };
}
