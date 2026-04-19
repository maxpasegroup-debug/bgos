import type { SalesNetworkRole } from "@prisma/client";
import { SalesNetworkRole as SNR } from "@prisma/client";
import type { NexaMode } from "@/lib/nexa-ceo/nexa-mode";

/**
 * Role-based tone labels (documentation + optional UI).
 */
export type NexaToneProfile = "bde" | "bdm" | "rsm" | "boss";

export function resolveNexaToneProfile(
  salesNetworkRole: SalesNetworkRole | null | undefined,
  nexaMode: NexaMode,
): NexaToneProfile {
  if (nexaMode === "ceo") return "boss";
  if (salesNetworkRole === SNR.RSM) return "rsm";
  if (salesNetworkRole === SNR.BDM) return "bdm";
  return "bde";
}

export const NEXA_TONE_HINT: Record<NexaToneProfile, string> = {
  bde: "Coaching: clear steps, light urgency, credible encouragement.",
  bdm: "Leadership: strategy, team conversion, accountability.",
  rsm: "Management: regions, metrics, decisive follow-through.",
  boss: "CEO: executive summary, risk, opportunity, decision-ready.",
};
