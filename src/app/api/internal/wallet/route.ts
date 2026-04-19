/**
 * GET /api/internal/wallet
 *
 * Returns the caller's wallet balance + recent transactions.
 * Never exposes commission breakdowns — only aggregate balances and
 * type labels (DIRECT, RECURRING, BONUS, REWARD, ADJUSTMENT, WITHDRAWAL).
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { getWalletWithTransactions } from "@/lib/internal-wallet";

export async function GET(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  const { wallet, recentTransactions } = await getWalletWithTransactions(
    session.userId,
    20,
  );

  return NextResponse.json({
    ok: true as const,
    total_balance: wallet.totalBalance,
    withdrawable_balance: wallet.withdrawableBalance,
    bonus_balance: wallet.bonusBalance,
    pending_balance: wallet.pendingBalance,
    updated_at: wallet.updatedAt.toISOString(),
    recent_transactions: recentTransactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      status: t.status,
      note: t.note ?? undefined,
      created_at: t.createdAt.toISOString(),
    })),
  });
}
