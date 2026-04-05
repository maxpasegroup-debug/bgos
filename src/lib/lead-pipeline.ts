import { LeadStatus } from "@prisma/client";

/**
 * Canonical pipeline order (forward moves: higher index = later stage).
 * Terminal: WON, LOST.
 */
export const LEAD_PIPELINE_ORDER: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.SITE_VISIT_SCHEDULED,
  LeadStatus.SITE_VISIT_COMPLETED,
  LeadStatus.PROPOSAL_SENT,
  LeadStatus.NEGOTIATION,
  LeadStatus.WON,
  LeadStatus.LOST,
];

const LABELS: Record<LeadStatus, string> = {
  [LeadStatus.NEW]: "New",
  [LeadStatus.CONTACTED]: "Contacted",
  [LeadStatus.QUALIFIED]: "Qualified",
  [LeadStatus.SITE_VISIT_SCHEDULED]: "Site Visit Scheduled",
  [LeadStatus.SITE_VISIT_COMPLETED]: "Site Visit Completed",
  [LeadStatus.PROPOSAL_SENT]: "Proposal Sent",
  [LeadStatus.NEGOTIATION]: "Negotiation",
  [LeadStatus.WON]: "Won",
  [LeadStatus.LOST]: "Lost",
};

export function leadStatusLabel(status: LeadStatus): string {
  return LABELS[status];
}

/** Statuses allowed as the next pipeline step from `from` (forward only). */
export function forwardLeadStatuses(from: LeadStatus): LeadStatus[] {
  if (from === LeadStatus.WON || from === LeadStatus.LOST) return [];
  const i = LEAD_PIPELINE_ORDER.indexOf(from);
  if (i === -1) return [];
  return LEAD_PIPELINE_ORDER.slice(i + 1);
}

export function validateLeadStatusTransition(
  from: LeadStatus,
  to: LeadStatus,
): { ok: true } | { ok: false; error: string } {
  if (from === to) return { ok: true };
  if (from === LeadStatus.WON || from === LeadStatus.LOST) {
    return { ok: false, error: "Cannot change status of a closed lead" };
  }
  const i = LEAD_PIPELINE_ORDER.indexOf(from);
  const j = LEAD_PIPELINE_ORDER.indexOf(to);
  if (i === -1 || j === -1 || j <= i) {
    return { ok: false, error: "Invalid pipeline transition (must move forward)" };
  }
  return { ok: true };
}
