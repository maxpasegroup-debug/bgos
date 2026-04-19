import type { SalesHierarchyPlan } from "@prisma/client";

/** First points milestone for BDE — triggers one-time bonus accrual (see record-sale). */
export const BDE_POINTS_MILESTONE_FIRST = 20;

/** Notional INR bonus when crossing {@link BDE_POINTS_MILESTONE_FIRST} (productized in ledger). */
export const BDE_MILESTONE_BONUS_INR = 30_000;

/** BDE → BDM: minimum active subscriptions (status active, not expired). */
export const BDE_TO_BDM_ACTIVE_SUBS = 60;

/** BDM → RSM: minimum direct BDEs with at least one active sub (proxy: headcount). */
export const BDM_TO_RSM_MIN_BDES = 5;

/** BDM → RSM: minimum aggregated points from downline active subs (proxy for revenue). */
export const BDM_TO_RSM_MIN_NETWORK_POINTS = 500;

/** Grace band when BDM drops below promotion threshold. */
export const BDM_GRACE_LOW = 55;
export const BDM_FULL_MIN = 60;

/** Points awarded per sale (hierarchy plan). */
export const POINTS_BY_PLAN: Record<SalesHierarchyPlan, number> = {
  BASIC: 1,
  PRO: 2,
  CUSTOM: 3,
}

/** Optional CUSTOM points override (max 5). */
export const CUSTOM_POINTS_MAX = 5;

/** Default subscription term when recording a sale (days). */
export const DEFAULT_SUBSCRIPTION_TERM_DAYS = 365;

/** Notional sale value for earnings split (INR). */
export const PLAN_SALE_VALUE_INR: Record<SalesHierarchyPlan, number> = {
  BASIC: 999,
  PRO: 4999,
  CUSTOM: 15000,
};

/** Override percentages (of sale value). */
export const OVERRIDE_BDM_FROM_BDE = 0.08;
export const OVERRIDE_RSM_FROM_BDM_LAYER = 0.04;

/** BDE recurring cap: fraction of direct recurring accrual vs BDM+ (0–1). */
export const BDE_RECURRING_CAP_RATIO = 0.5;

/** Initial BDE slots when promoted to BDM. */
export const BDM_INITIAL_BDE_SLOTS = 10;

/** Slot expansion when team performance high (active subs under BDM). */
export const BDM_SLOT_BONUS_THRESHOLD = 80;
export const BDM_SLOT_BONUS_EXTRA = 5;
