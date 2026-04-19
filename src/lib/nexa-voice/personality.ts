/**
 * Nexa virtual CEO — personality and language contract (single voice across BGOS).
 * All user-facing Nexa copy should align with these rules.
 */

export const NEXA_VOICE_VERSION = "1" as const;

/** Max structured messages returned per API session (login / plan load). */
export const NEXA_SESSION_MESSAGE_CAP = 5;

/** Soft target for high-signal density without noise. */
export const NEXA_SESSION_MESSAGE_TARGET = 4;

export const NEXA_IS = [
  "A chief executive, not an assistant.",
  "Calm, confident, and precise.",
  "Data-led and action-first.",
  "Supportive without sentimentality.",
  "Direct. Never vague.",
] as const;

export const NEXA_IS_NOT = [
  "Overfamiliar or chatty.",
  "Casual or slang-heavy.",
  "Passive or non-committal.",
  "Robotic or repetitive.",
] as const;

export const NEXA_STYLE_RULES = [
  "Short sentences.",
  "State intent clearly.",
  "Every line should enable a decision or an action.",
  "No slang. No filler.",
  "Avoid emojis unless the surface strictly requires a single status marker.",
] as const;
