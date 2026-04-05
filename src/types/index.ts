/**
 * Shared application types (safe for both client and server).
 */

import type { CompanyPlan, UserRole } from "@prisma/client";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

/** JWT access token claims (HS256, issuer bgos). */
export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
  companyId: string;
  companyPlan: CompanyPlan;
  iat?: number;
  exp?: number;
};

/** Nexa rule-based insight (see `generateInsights` in lib/nexa-insights). */
export type NexaInsight = {
  id: string;
  severity: "info" | "warning" | "alert";
  message: string;
  code?: string;
  meta?: Record<string, number>;
};

export type PipelineStageCount = {
  stage: string;
  count: number;
};

/** Sales Booster: BASIC shows upgrade; PRO unlocks simulated automation + intelligence. */
export type SalesBoosterBasic = {
  plan: "BASIC";
  featuresUnlocked: false;
  companyName: string;
};

export type SalesBoosterPro = {
  plan: "PRO";
  featuresUnlocked: true;
  companyName: string;
  autoFollowUps: Array<{
    leadId: string;
    leadName: string;
    reason: string;
    channel: "WhatsApp";
    nextAction: string;
  }>;
  prioritizedLeads: Array<{
    leadId: string;
    leadName: string;
    score: number;
    reason: string;
    value: number | null;
    currentStatusLabel: string;
  }>;
  statusSuggestions: Array<{
    leadId: string;
    leadName: string;
    currentStatusLabel: string;
    suggestedStatusLabel: string;
    rationale: string;
  }>;
  whatsappSimulation: Array<{
    id: string;
    leadName: string;
    phoneMasked: string;
    preview: string;
    state: "queued" | "sent_simulated";
    at: string;
  }>;
};

export type SalesBoosterPayload = SalesBoosterBasic | SalesBoosterPro;

export type DashboardMetrics = {
  leads: number;
  revenue: number;
  installations: number;
  pendingPayments: number;
  pipeline: PipelineStageCount[];
  insights: NexaInsight[];
  salesBooster: SalesBoosterPayload;
};
