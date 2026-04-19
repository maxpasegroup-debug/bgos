/**
 * Internal Fraud Guard  (bgos_fraud_guard_v1)
 *
 * Prevents double-earning by detecting duplicate client contacts/emails
 * across sales in the same internal org:
 *
 *   - Same clientEmail already converted by a DIFFERENT BDE → DUPLICATE_EMAIL
 *   - Same clientPhone already converted by a DIFFERENT BDE → DUPLICATE_PHONE
 *   - Same BDE submitting the same email/phone twice          → SELF_DUPLICATE
 *
 * When a duplicate is detected:
 *   1. The subscription is still created (audit trail) with fraudFlagged=true.
 *   2. Wallet credits (direct + override earnings) are BLOCKED.
 *   3. A row is written to InternalFraudLog for BOSS review.
 */

import "server-only";

import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Reason codes
// ---------------------------------------------------------------------------

export const FraudReason = {
  DUPLICATE_EMAIL:   "DUPLICATE_EMAIL",
  DUPLICATE_PHONE:   "DUPLICATE_PHONE",
  DUPLICATE_CONTACT: "DUPLICATE_CONTACT", // both email AND phone match
  SELF_DUPLICATE:    "SELF_DUPLICATE",
} as const;

export type FraudReasonCode = (typeof FraudReason)[keyof typeof FraudReason];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DuplicateCheckInput = {
  companyId:       string;
  soldByUserId:    string;
  clientEmail?:    string | null;
  clientPhone?:    string | null;
};

export type DuplicateCheckResult =
  | { flagged: false }
  | {
      flagged:     true;
      reason:      FraudReasonCode;
      description: string;
      /** Extra context to persist in InternalFraudLog.metadata */
      meta:        Record<string, unknown>;
    };

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function normaliseEmail(e: string): string {
  return e.trim().toLowerCase();
}

function normalisePhone(p: string): string {
  // Strip spaces, dashes, parentheses, plus signs for comparison
  return p.replace(/[\s\-().+]/g, "").toLowerCase();
}

// ---------------------------------------------------------------------------
// checkDuplicateSale
//
// Queries existing ACTIVE (non-flagged) subscriptions in the same company for
// matching clientEmail / clientPhone.  Returns the first conflict found.
// ---------------------------------------------------------------------------

export async function checkDuplicateSale(
  input: DuplicateCheckInput,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<DuplicateCheckResult> {
  const { companyId, soldByUserId, clientEmail, clientPhone } = input;

  const hasEmail = !!clientEmail?.trim();
  const hasPhone = !!clientPhone?.trim();

  if (!hasEmail && !hasPhone) return { flagged: false };

  const normEmail = hasEmail ? normaliseEmail(clientEmail!) : null;
  const normPhone = hasPhone ? normalisePhone(clientPhone!) : null;

  // Build OR conditions for the query
  const orConditions: Array<Record<string, unknown>> = [];
  if (normEmail) orConditions.push({ clientEmail: normEmail });
  if (normPhone) orConditions.push({ clientPhone: normPhone });

  const existing = await prismaClient.salesHierarchySubscription.findFirst({
    where: {
      companyId,
      fraudFlagged: false,
      OR: orConditions,
    },
    select: {
      id:           true,
      ownerUserId:  true,
      clientEmail:  true,
      clientPhone:  true,
      planType:     true,
      startedAt:    true,
    },
    orderBy: { startedAt: "asc" },
  });

  if (!existing) return { flagged: false };

  const conflictUserId = existing.ownerUserId;
  const isSelf         = conflictUserId === soldByUserId;

  // Determine which field(s) matched
  const emailMatch =
    normEmail !== null &&
    existing.clientEmail !== null &&
    normaliseEmail(existing.clientEmail) === normEmail;
  const phoneMatch =
    normPhone !== null &&
    existing.clientPhone !== null &&
    normalisePhone(existing.clientPhone) === normPhone;

  let reason: FraudReasonCode;
  if (emailMatch && phoneMatch) {
    reason = FraudReason.DUPLICATE_CONTACT;
  } else if (emailMatch) {
    reason = isSelf ? FraudReason.SELF_DUPLICATE : FraudReason.DUPLICATE_EMAIL;
  } else {
    reason = isSelf ? FraudReason.SELF_DUPLICATE : FraudReason.DUPLICATE_PHONE;
  }

  const who   = isSelf ? "same BDE" : `another BDE (${conflictUserId})`;
  const field = emailMatch && phoneMatch
    ? `email "${clientEmail}" and phone "${clientPhone}"`
    : emailMatch
      ? `email "${clientEmail}"`
      : `phone "${clientPhone}"`;

  const description =
    `Duplicate sale blocked — ${field} was already used in subscription ` +
    `${existing.id} by ${who} on ${existing.startedAt.toISOString().slice(0, 10)}.`;

  return {
    flagged: true,
    reason,
    description,
    meta: {
      conflictSubscriptionId: existing.id,
      conflictUserId,
      isSelf,
      matchedEmail: emailMatch ? normEmail : null,
      matchedPhone: phoneMatch ? normPhone : null,
      conflictPlan: existing.planType,
      conflictStartedAt: existing.startedAt.toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// logFraudEvent
//
// Writes one row to InternalFraudLog. Fire-and-forget safe; never throws.
// ---------------------------------------------------------------------------

export async function logFraudEvent(
  {
    companyId,
    triggeredByUserId,
    subscriptionId,
    reason,
    description,
    metadata,
  }: {
    companyId:          string;
    triggeredByUserId?: string;
    subscriptionId?:    string;
    reason:             FraudReasonCode;
    description:        string;
    metadata?:          Record<string, unknown>;
  },
  prismaClient: PrismaClient = defaultPrisma,
): Promise<void> {
  try {
    await prismaClient.internalFraudLog.create({
      data: {
        companyId,
        triggeredByUserId: triggeredByUserId ?? null,
        subscriptionId:    subscriptionId    ?? null,
        reason,
        description,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Never let fraud logging crash the main flow
    console.error("[fraud-guard] Failed to write fraud log:", err);
  }
}

// ---------------------------------------------------------------------------
// getFraudLogs
//
// Used by the BOSS-only /api/internal/fraud endpoint.
// ---------------------------------------------------------------------------

export type FraudLogRow = {
  id:                string;
  reason:            string;
  description:       string;
  metadata:          unknown;
  createdAt:         string;
  triggeredByUserId: string | null;
  triggeredByName:   string | null;
  subscriptionId:    string | null;
};

export async function getFraudLogs(
  companyId: string,
  limit = 100,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<FraudLogRow[]> {
  const rows = await prismaClient.internalFraudLog.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id:                true,
      reason:            true,
      description:       true,
      metadata:          true,
      createdAt:         true,
      triggeredByUserId: true,
      subscriptionId:    true,
      triggeredByUser: {
        select: { name: true },
      },
    },
  });

  return rows.map((r) => ({
    id:                r.id,
    reason:            r.reason,
    description:       r.description,
    metadata:          r.metadata,
    createdAt:         r.createdAt.toISOString(),
    triggeredByUserId: r.triggeredByUserId,
    triggeredByName:   r.triggeredByUser?.name ?? null,
    subscriptionId:    r.subscriptionId,
  }));
}
