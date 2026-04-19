/**
 * Internal Sales Engine — commission and points configuration.
 *
 * These values govern the NEW internal-staff hierarchy system exposed under
 * /internal/sales/*  (separate from the tenant-level sales hierarchy that uses
 * src/config/sales-hierarchy.ts).
 *
 * Commission amounts are in INR.
 * Points are stored as integers; 1.5 (PRO) is represented as 15 using a ×10 scale
 * to avoid a schema migration on the integer `points` column.
 */

/** ×10 scale factor — stored points ÷ POINTS_SCALE = display points. */
export const POINTS_SCALE = 10;

/**
 * Points awarded per plan (×10 scale).
 * Spec: BASIC=1, PRO=1.5, ENTERPRISE=3  →  stored as 10, 15, 30.
 */
export const ISE_POINTS_BY_PLAN: Record<"BASIC" | "PRO" | "ENTERPRISE", number> = {
  BASIC: 10,
  PRO: 15,
  ENTERPRISE: 30,
};

/** Default subscription duration (days). */
export const ISE_SUBSCRIPTION_TERM_DAYS = 365;

// ---------------------------------------------------------------------------
// DIRECT commission (fixed INR credited to the seller on each subscription sale)
// ---------------------------------------------------------------------------
export const ISE_DIRECT_COMMISSION: Record<"BASIC" | "PRO" | "ENTERPRISE", number> = {
  BASIC: 1500,
  PRO: 2000,
  ENTERPRISE: 3000,
};

// ---------------------------------------------------------------------------
// OVERRIDE commissions (flat INR credited to upline when a BDE makes a sale)
// ---------------------------------------------------------------------------

/** BDM receives a flat override per BDE sale. */
export const ISE_OVERRIDE_BDM: Record<"BASIC" | "PRO" | "ENTERPRISE", number> = {
  BASIC: 250,
  PRO: 500,
  ENTERPRISE: 750,
};

/** RSM receives a flat override per BDE sale (via BDM layer). */
export const ISE_OVERRIDE_RSM: Record<"BASIC" | "PRO" | "ENTERPRISE", number> = {
  BASIC: 150,
  PRO: 250,
  ENTERPRISE: 400,
};

// ---------------------------------------------------------------------------
// MILESTONE bonus (DIRECT to seller when their cumulative points hit threshold)
// ---------------------------------------------------------------------------

/** Points threshold (scaled) that triggers a one-time milestone bonus. */
export const ISE_MILESTONE_POINTS_THRESHOLD = 200; // 200 stored = 20 display

/** Bonus amount (INR) credited when the milestone threshold is crossed. */
export const ISE_MILESTONE_BONUS_AMOUNT = 1000;

// ---------------------------------------------------------------------------
// RECURRING — BDE unlock (hidden from UI)
// ---------------------------------------------------------------------------

/**
 * Minimum active subscriptions for a BDE to unlock recurring income.
 * This check is internal and must not be exposed in UI responses.
 */
export const ISE_BDE_RECURRING_UNLOCK_SUBS = 20;

/** Monthly recurring amount (INR) credited to a BDE once unlocked. */
export const ISE_BDE_RECURRING_MONTHLY = 2000;

// ---------------------------------------------------------------------------
// RECURRING — BDM per-plan slabs (bgos_recurring_engine_v1)
//
// Evaluated against the BDM's network (sum of BDE active subs by plan type).
// Slabs are ordered ascending; highest matching tier wins per plan.
// Total BDM monthly recurring = BASIC slab amount + PRO slab amount.
// ---------------------------------------------------------------------------

export type BdmPlanRecurringSlab = {
  minSubs: number;
  monthlyAmount: number;
};

/**
 * BDM recurring slabs keyed by subscription plan type.
 * Apply the highest matching slab for each plan; sum the results.
 */
export const ISE_BDM_RECURRING_BY_PLAN: Record<"BASIC" | "PRO", BdmPlanRecurringSlab[]> = {
  BASIC: [
    { minSubs: 20, monthlyAmount: 500 },
    { minSubs: 40, monthlyAmount: 650 },
    { minSubs: 50, monthlyAmount: 750 }, // cap
  ],
  PRO: [
    { minSubs: 20, monthlyAmount: 750 },
    { minSubs: 50, monthlyAmount: 1000 }, // cap
  ],
};

// ---------------------------------------------------------------------------
// RECURRING — legacy BDM tier config (kept for backward-compat references)
// ---------------------------------------------------------------------------

export type BdmRecurringTier = {
  minSubs: number;
  monthlyAmount: number;
  label: string;
};

/** @deprecated  Use ISE_BDM_RECURRING_BY_PLAN instead (bgos_recurring_engine_v1). */
export const ISE_BDM_RECURRING_TIERS: BdmRecurringTier[] = [
  { minSubs: 20, monthlyAmount: 5000, label: "base" },
  { minSubs: 40, monthlyAmount: 8000, label: "increase" },
  { minSubs: 50, monthlyAmount: 12000, label: "max_cap" },
];

// ---------------------------------------------------------------------------
// RECURRING — downgrade grace period
// ---------------------------------------------------------------------------

/**
 * Days the engine waits before applying a lower recurring slab after active
 * subscription count drops below the current tier threshold.
 */
export const ISE_RECURRING_GRACE_DAYS = 7;

// ---------------------------------------------------------------------------
// PROMOTION thresholds (mirrored from config/sales-hierarchy.ts for reference)
// ---------------------------------------------------------------------------

/** BDE → BDM: minimum active subscriptions owned by the BDE. */
export const ISE_BDE_TO_BDM_ACTIVE_SUBS = 60;

/** BDM → RSM: minimum direct BDE headcount under the BDM. */
export const ISE_BDM_TO_RSM_MIN_BDES = 5;

/** BDM → RSM: minimum aggregated active subs from downline (proxy for revenue). */
export const ISE_BDM_TO_RSM_MIN_NETWORK_POINTS = 500;

// ---------------------------------------------------------------------------
// MONTHLY performance stats window
// ---------------------------------------------------------------------------

/** How many calendar months of earnings to include in monthly stats. */
export const ISE_STATS_MONTHS_WINDOW = 6;
