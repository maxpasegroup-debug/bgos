import type { NexaMessageKind } from "@/lib/nexa-voice/message-kind";

/**
 * Mandatory structure for Nexa lines: Context → Insight → Action.
 * Each segment is one short sentence where possible.
 */
export type NexaFrameworkParts = {
  context: string;
  insight: string;
  action: string;
};

export type NexaStructuredMessage = {
  kind: NexaMessageKind;
  parts: NexaFrameworkParts;
  /** Single block for logs, SMS-style surfaces, legacy fields. */
  text: string;
};

/**
 * Joins three parts into one executive line (no line breaks for compact JSON).
 */
export function formatNexaFramework(parts: NexaFrameworkParts): string {
  const s = [parts.context, parts.insight, parts.action]
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  return s.join(" ");
}

/**
 * Three lines — for UI blocks that show Context / Insight / Action explicitly.
 */
export function formatNexaFrameworkLines(parts: NexaFrameworkParts): string {
  return [parts.context, parts.insight, parts.action].map((x) => x.trim()).join("\n");
}

export function nexaMessage(kind: NexaMessageKind, parts: NexaFrameworkParts): NexaStructuredMessage {
  return { kind, parts, text: formatNexaFramework(parts) };
}

/** Optional first-name prefix: "Arun, " — no comma if no name. */
export function nexaAddress(name: string | null | undefined): string {
  const n = typeof name === "string" ? name.trim().split(/\s+/)[0] : "";
  if (!n) return "";
  return `${n}, `;
}
