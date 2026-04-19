/**
 * Override earnings distributor  (bgos_hierarchy_earnings_v1)
 *
 * distributeOverrideEarnings() must be called INSIDE an existing Prisma
 * transaction so the override rows are written atomically with the triggering
 * subscription and the BDE direct earning.
 *
 * Hierarchy walk:
 *   BDE sale  → parent BDM  → grandparent RSM
 *   BDM sale  → parent RSM  (BDM selling directly — no BDM override, only RSM)
 *
 * Idempotency:
 *   Before each INSERT we check whether a OVERRIDE earning for
 *   (companyId, subscriptionId, userId) already exists.  If it does, that
 *   row is skipped and `*Created = false` in the returned result.
 *   This makes the function safe to retry without producing duplicate credits.
 *
 * The wallet credit (pendingBalance) is NOT performed here — callers must
 * call creditWallet() post-transaction once they know bdmId / rsmId.
 */

import "server-only";

import { NetworkCommissionType, SalesNetworkRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  ISE_OVERRIDE_BDM,
  ISE_OVERRIDE_RSM,
} from "@/config/internal-sales-engine";
import type { IseInternalPlan } from "@/lib/internal-sales-engine";

// ---------------------------------------------------------------------------
// Minimal db-client type accepted by the function.
// Using a structural Pick so the function can be called with either a
// full PrismaClient or a Prisma transaction client (tx).
// ---------------------------------------------------------------------------

type DbClient = Pick<PrismaClient, "salesHierarchyEarning" | "userCompany">;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DistributeOverrideInput = {
  companyId: string;
  /** ID of the freshly created SalesHierarchySubscription. */
  subscriptionId: string;
  /** User who made the sale (BDE or BDM). */
  soldByUserId: string;
  /** Role of the seller — determines which legs of the hierarchy fire. */
  sellerRole: SalesNetworkRole;
  /** parentUserId from the seller's UserCompany row (may be null). */
  sellerParentUserId: string | null;
  planType: IseInternalPlan;
};

export type DistributeOverrideResult = {
  /** BDM who receives the override (null if none applicable). */
  bdmId: string | null;
  /** RSM who receives the override (null if none applicable). */
  rsmId: string | null;
  /** True when the BDM earning row was newly created (false = already existed). */
  bdmEarningCreated: boolean;
  /** True when the RSM earning row was newly created (false = already existed). */
  rsmEarningCreated: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when an override earning already exists for this slot. */
async function overrideExists(
  db: DbClient,
  companyId: string,
  subscriptionId: string,
  userId: string,
): Promise<boolean> {
  const row = await db.salesHierarchyEarning.findFirst({
    where: {
      companyId,
      subscriptionId,
      userId,
      type: NetworkCommissionType.OVERRIDE,
    },
    select: { id: true },
  });
  return row !== null;
}

/** Creates one override earning row and returns the earning id. */
async function createOverride(
  db: DbClient,
  companyId: string,
  subscriptionId: string,
  recipientId: string,
  sourceUserId: string,
  amount: number,
): Promise<string> {
  const row = await db.salesHierarchyEarning.create({
    data: {
      companyId,
      userId: recipientId,
      sourceUserId,
      subscriptionId,
      amount,
      type: NetworkCommissionType.OVERRIDE,
      // payoutStatus defaults to PENDING — set by schema default
    },
    select: { id: true },
  });
  return row.id;
}

// ---------------------------------------------------------------------------
// distributeOverrideEarnings
// ---------------------------------------------------------------------------

/**
 * Walks the seller's hierarchy and creates OVERRIDE earning rows.
 *
 * Called inside the handleSale() $transaction so all inserts are atomic.
 * Accepts any Prisma client that exposes .salesHierarchyEarning and
 * .userCompany (a full PrismaClient or a tx-scoped transaction client).
 *
 * Returns the resolved BDM/RSM user IDs so the caller can credit their
 * wallets post-transaction via creditWallet().
 */
export async function distributeOverrideEarnings(
  input: DistributeOverrideInput,
  db: DbClient,
): Promise<DistributeOverrideResult> {
  const {
    companyId,
    subscriptionId,
    soldByUserId,
    sellerRole,
    sellerParentUserId,
    planType,
  } = input;

  const result: DistributeOverrideResult = {
    bdmId: null,
    rsmId: null,
    bdmEarningCreated: false,
    rsmEarningCreated: false,
  };

  if (!sellerParentUserId) return result;

  // ── BDE sale: parent must be BDM; grandparent must be RSM ─────────────────
  if (sellerRole === SalesNetworkRole.BDE) {
    const parentMem = await db.userCompany.findUnique({
      where: { userId_companyId: { userId: sellerParentUserId, companyId } },
      select: { salesNetworkRole: true, parentUserId: true },
    });

    if (parentMem?.salesNetworkRole === SalesNetworkRole.BDM) {
      const bdmId = sellerParentUserId;
      result.bdmId = bdmId;

      // Idempotency: skip if already exists
      const bdmAlreadyExists = await overrideExists(db, companyId, subscriptionId, bdmId);
      if (!bdmAlreadyExists) {
        await createOverride(
          db,
          companyId,
          subscriptionId,
          bdmId,
          soldByUserId,
          ISE_OVERRIDE_BDM[planType],
        );
        result.bdmEarningCreated = true;
      }

      // Walk one level higher for RSM
      if (parentMem.parentUserId) {
        const rsmMem = await db.userCompany.findUnique({
          where: { userId_companyId: { userId: parentMem.parentUserId, companyId } },
          select: { salesNetworkRole: true },
        });

        if (rsmMem?.salesNetworkRole === SalesNetworkRole.RSM) {
          const rsmId = parentMem.parentUserId;
          result.rsmId = rsmId;

          const rsmAlreadyExists = await overrideExists(db, companyId, subscriptionId, rsmId);
          if (!rsmAlreadyExists) {
            await createOverride(
              db,
              companyId,
              subscriptionId,
              rsmId,
              soldByUserId,
              ISE_OVERRIDE_RSM[planType],
            );
            result.rsmEarningCreated = true;
          }
        }
      }
    }

    return result;
  }

  // ── BDM sale: no BDM-level override; parent must be RSM ───────────────────
  if (sellerRole === SalesNetworkRole.BDM) {
    const parentMem = await db.userCompany.findUnique({
      where: { userId_companyId: { userId: sellerParentUserId, companyId } },
      select: { salesNetworkRole: true },
    });

    if (parentMem?.salesNetworkRole === SalesNetworkRole.RSM) {
      const rsmId = sellerParentUserId;
      result.rsmId = rsmId;

      const rsmAlreadyExists = await overrideExists(db, companyId, subscriptionId, rsmId);
      if (!rsmAlreadyExists) {
        await createOverride(
          db,
          companyId,
          subscriptionId,
          rsmId,
          soldByUserId,
          ISE_OVERRIDE_RSM[planType],
        );
        result.rsmEarningCreated = true;
      }
    }

    return result;
  }

  // RSM / BOSS / TECH_EXEC selling directly — no override chain applicable
  return result;
}
