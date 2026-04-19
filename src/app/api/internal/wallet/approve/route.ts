/**
 * POST /api/internal/wallet/approve
 *
 * BOSS-triggered payout cycle. Routes through runMonthlyPayoutCycle() so that
 * the full earning approval lifecycle (PENDING → APPROVED → PAID) is respected.
 *
 * Direct wallet manipulation is not permitted (bgos_payout_cycle_v1).
 * All balance promotion must flow through the payout cycle.
 *
 * Access: BOSS only.
 * Body: {} (no parameters — always runs the full cycle)
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { runMonthlyPayoutCycle, getPayoutStats } from "@/lib/internal-payout-cycle";
import { SalesNetworkRole } from "@prisma/client";

export async function POST(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  if (session.salesNetworkRole !== SalesNetworkRole.BOSS) {
    return NextResponse.json(
      { ok: false as const, error: "Forbidden", code: "FORBIDDEN" as const },
      { status: 403 },
    );
  }

  // Cutoff: start of today UTC — anything created before today is eligible.
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);

  try {
    const summary = await runMonthlyPayoutCycle(cutoff);

    return NextResponse.json({
      ok: true as const,
      // Expose opaque counts only — no amounts (bgos_payout_cycle_v1 rule)
      approved_count: summary.walletTxCredited,
      earnings_approved: summary.earningsApproved,
      earnings_paid: summary.earningsPaid,
      recurring_credited: summary.recurring.credited,
      cycle_errors: summary.errors.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false as const, error: msg },
      { status: 500 },
    );
  }
}

/**
 * GET /api/internal/wallet/approve
 * Returns backlog counts for the Boss dashboard (no amounts).
 */
export async function GET(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  if (session.salesNetworkRole !== SalesNetworkRole.BOSS) {
    return NextResponse.json(
      { ok: false as const, error: "Forbidden", code: "FORBIDDEN" as const },
      { status: 403 },
    );
  }

  try {
    const stats = await getPayoutStats();
    return NextResponse.json({ ok: true as const, ...stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
