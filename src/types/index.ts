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
  /** Set only for {@link process.env.BGOS_BOSS_EMAIL} at login / token mint — do not trust from clients. */
  superBoss?: boolean;
  /** ICECONNECT workforce identity (see Prisma User.employeeSystem). */
  employeeSystem?: "BGOS" | "ICECONNECT";
  employeeDomain?: "BGOS" | "SOLAR";
  iceconnectEmployeeRole?: "RSM" | "BDM" | "BDE" | "TECH_EXEC";
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
  plan: "PRO" | "ENTERPRISE";
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
    assigneeName: string;
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
  onLeadCreated: "assign" | "whatsapp" | "both";
  followUpScheduleEnabled: boolean;
  scheduledBoosterTaskCount: number;
  advancedAddon: boolean;
  aiAutoReplies: boolean;
  campaignAutomation: boolean;
  leadScoring: boolean;
};

export type SalesBoosterPayload = SalesBoosterBasic | SalesBoosterPro;

export type NexaSnapshot = {
  pendingFollowUps: number;
  overdueFollowUps: number;
  delays: number;
  opportunities: number;
};

/** Pro+ Automation Center panel (master toggle + snapshot stats). */
export type DashboardAutomationCenter = {
  enabled: boolean;
  activeFlows: number;
  followUpsPending: number;
  overdueFollowUps: number;
  nexaSuggestion: string | null;
};

export type DashboardOperations = {
  installationQueue: number;
  openServiceTickets: number;
  pendingPayments: number;
  pendingSiteVisits: number;
  pendingApprovals: number;
  installationsInProgress: number;
};

export type DashboardRevenueBreakdown = {
  /** Invoice payments collected in the current calendar month. */
  monthlyWon: number;
  pipelineValue: number;
  expectedClosures: number;
  /** Total receivable (unpaid invoice balances). */
  pendingAmount: number;
  unpaidInvoiceCount: number;
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

export type DashboardHrSummary = {
  totalEmployees: number;
  leavesPending: number;
  attendancePercent: number;
};

export type DashboardInventorySummary = {
  products: number;
  lowStockItems: number;
  totalUnits: number;
};

export type DashboardPartnerSummary = {
  totalPartnerLeads: number;
  totalCommissionPayable: number;
};

/** Money-layer metrics (invoices, payments, expenses) for BGOS financial overview. */
export type DashboardMonthlyTrendPoint = {
  monthKey: string;
  label: string;
  amount: number;
};

export type DashboardFinancialOverview = {
  totalRevenue: number;
  /** Sum of unpaid invoice balances. */
  pendingPayments: number;
  unpaidInvoiceCount: number;
  monthlyRevenue: number;
  totalExpenses: number;
  /** Expenses recorded in the current calendar month. */
  currentMonthExpenses: number;
  netProfit: number;
  monthlyRevenueTrend: DashboardMonthlyTrendPoint[];
  monthlyExpenseTrend: DashboardMonthlyTrendPoint[];
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

export type DashboardAnalyticsTrendPoint = {
  key: string;
  label: string;
  revenue: number;
  leads: number;
  expenses: number;
};

export type DashboardAnalytics = {
  revenue: number;
  leads: number;
  conversionPercent: number;
  expenses: number;
  trend: DashboardAnalyticsTrendPoint[];
};

export type DashboardAnalyticsRangeMeta = {
  preset: string;
  from: string;
  to: string;
  label: string;
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
  /** Pro+ only; `null` on Basic. */
  automationCenter: DashboardAutomationCenter | null;
  operations: DashboardOperations;
  revenueBreakdown: DashboardRevenueBreakdown;
  risks: DashboardRisks;
  health: DashboardHealth;
  hr: DashboardHrSummary;
  inventory: DashboardInventorySummary;
  partner: DashboardPartnerSummary;
  team: TeamMemberPerformance[];
  financial: DashboardFinancialOverview;
  /** Period-scoped KPIs + trend (see `analyticsRange`). */
  analytics: DashboardAnalytics;
  analyticsRange: DashboardAnalyticsRangeMeta;
};
