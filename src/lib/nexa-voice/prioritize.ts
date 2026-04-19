import { NEXA_SESSION_MESSAGE_CAP } from "@/lib/nexa-voice/personality";
import { NEXA_MESSAGE_KIND_PRIORITY, type NexaMessageKind } from "@/lib/nexa-voice/message-kind";
import type { NexaStructuredMessage } from "@/lib/nexa-voice/framework";

/**
 * Keeps the highest-impact messages first, then trims to session cap.
 */
export function prioritizeNexaSessionMessages(messages: NexaStructuredMessage[]): NexaStructuredMessage[] {
  const sorted = [...messages].sort(
    (a, b) => NEXA_MESSAGE_KIND_PRIORITY[b.kind] - NEXA_MESSAGE_KIND_PRIORITY[a.kind],
  );
  const out: NexaStructuredMessage[] = [];
  const seen = new Set<string>();
  for (const m of sorted) {
    const key = `${m.kind}:${m.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= NEXA_SESSION_MESSAGE_CAP) break;
  }
  return out;
}

export function kindRank(kind: NexaMessageKind): number {
  return NEXA_MESSAGE_KIND_PRIORITY[kind];
}
