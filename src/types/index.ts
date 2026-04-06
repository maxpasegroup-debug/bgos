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
  /** Set after onboarding; `null` until the user creates or joins a company. */
  companyId: string | null;
  /** Snapshot for the active company; detail plans live in `memberships` (Company.plan each). */
  companyPlan: CompanyPlan;
  /**
   * `false` until the boss completes onboarding step 2 (NEXA activation).
   * Omitted in legacy JWTs — decoded as `true` so existing sessions keep access.
   */
  workspaceReady: boolean;
  /** All companies the user belongs to (for active-company cookie validation on Edge). */
  memberships?: Array<{
    companyId: string;
    plan: CompanyPlan;
    jobRole: UserRole;
  }>;
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
    trigger: "overdue_task" | "stale_lead" | "due_within_24h";
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

export type NexaSnapshot = {
  pendingFollowUps: number;
  overdueFollowUps: number;
  delays: number;
  opportunities: number;
};

export type DashboardOperations = {
  installationQueue: number;
  openServiceTickets: number;
  pendingPayments: number;
};

export type DashboardRevenueBreakdown = {
  monthlyWon: number;
  pipelineValue: number;
  expectedClosures: number;
  pendingAmount: number;
};

export type DashboardRisks = {
  lostLeads: number;
  delays: number;
  openServiceTickets: number;
};

export type DashboardHealth = {
  efficiency: number;
  conversion: number;
  teamProductivity: number;
};

/** Money-layer metrics (invoices, payments, expenses) for BGOS financial overview. */
export type DashboardMonthlyTrendPoint = {
  monthKey: string;
  label: string;
  amount: number;
};

export type DashboardFinancialOverview = {
  totalRevenue: number;
  pendingPayments: number;
  monthlyRevenue: number;
  totalExpenses: number;
  netProfit: number;
  monthlyRevenueTrend: DashboardMonthlyTrendPoint[];
  expenseChangePercent: number | null;
};

export type TeamMemberPerformance = {
  userId: string;
  name: string;
  email: string;
  role: string;
  assignedLeads: number;
  wonLeads: number;
  pendingTasks: number;
};

export type DashboardMetrics = {
  leads: number;
  revenue: number;
  installations: number;
  pendingPayments: number;
  pipeline: PipelineStageCount[];
  insights: NexaInsight[];
  salesBooster: SalesBoosterPayload;
  nexa: NexaSnapshot;
  operations: DashboardOperations;
  revenueBreakdown: DashboardRevenueBreakdown;
  risks: DashboardRisks;
  health: DashboardHealth;
  team: TeamMemberPerformance[];
  financial: DashboardFinancialOverview;
};
