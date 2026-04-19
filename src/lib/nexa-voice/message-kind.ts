/**
 * Nexa message taxonomy — used for prioritization and analytics.
 */
export type NexaMessageKind =
  | "coaching"
  | "alert"
  | "opportunity"
  | "recognition"
  | "warning"
  | "strategy";

/** Higher = surfaced first when capping session output. */
export const NEXA_MESSAGE_KIND_PRIORITY: Record<NexaMessageKind, number> = {
  warning: 60,
  alert: 50,
  strategy: 45,
  opportunity: 40,
  coaching: 30,
  recognition: 25,
};
