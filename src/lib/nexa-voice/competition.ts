import { nexaAddress, nexaMessage, type NexaStructuredMessage } from "@/lib/nexa-voice/framework";

export function nexaCompetitionRankMessage(
  firstName: string | null,
  rank: number,
  title: string,
): NexaStructuredMessage {
  const addr = nexaAddress(firstName);
  return nexaMessage("coaching", {
    context: `${addr}Competition: ${title}.`,
    insight: `You are rank ${rank}.`,
    action: rank > 1 ? "Increase qualified activity to move up." : "Defend position with consistent closes.",
  });
}

export function nexaCompetitionProgramMessage(): NexaStructuredMessage {
  return nexaMessage("opportunity", {
    context: "Weekly rewards apply to the top ten performers.",
    insight: "Rank moves on measured outcomes, not effort alone.",
    action: "Confirm your metrics daily. Adjust before the window closes.",
  });
}
