import { LeadStatus } from "@prisma/client";

/** High intent / late stage — prioritize calls. */
export const NEXA_HOT_LEAD_STATUSES: LeadStatus[] = [
  LeadStatus.NEGOTIATION,
  LeadStatus.PROPOSAL_SENT,
  LeadStatus.PROPOSAL_WON,
  LeadStatus.QUALIFIED,
];

/** Active nurture — follow-ups. */
export const NEXA_MEDIUM_LEAD_STATUSES: LeadStatus[] = [
  LeadStatus.CONTACTED,
  LeadStatus.SITE_VISIT_SCHEDULED,
  LeadStatus.SITE_VISIT_COMPLETED,
];

/** Early / idle — warm up or disqualify. */
export const NEXA_COLD_LEAD_STATUSES: LeadStatus[] = [LeadStatus.NEW];
