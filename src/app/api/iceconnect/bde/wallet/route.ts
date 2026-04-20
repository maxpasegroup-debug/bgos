import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { BdeWalletTransactionType } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { buildMoneyMessage, getOrCreateBdeWallet } from "@/lib/bde-wallet";
import { handleApiError } from "@/lib/route-error";
import { requireBde } from "@/lib/onboarding-request-guards";
import { prisma } from "@/lib/prisma";

function utcDayStart(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const gate = requireBde(session);
  if (gate instanceof NextResponse) return gate;

  const userId = session.sub;

  try {
    const wallet = await getOrCreateBdeWallet(userId);
    const start = utcDayStart(new Date());

    const [txs, todayAgg] = await Promise.all([
      prisma.bdeWalletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.bdeWalletTransaction.aggregate({
        where: {
          userId,
          createdAt: { gte: start },
          type: BdeWalletTransactionType.EARNING,
        },
        _sum: { amount: true },
      }),
    ]);

    const todayEarningSum = todayAgg._sum.amount ?? 0;

    const activity = txs.map((t) => {
      const sign = "+";
      const label =
        t.type === BdeWalletTransactionType.EARNING
          ? "Earned (conversion)"
          : t.type === BdeWalletTransactionType.BONUS
            ? "Bonus"
            : "Reward";
      return {
        id: t.id,
        label,
        amount_inr: t.amount,
        display: `${sign}₹${Math.round(t.amount).toLocaleString("en-IN")}`,
        type: t.type.toLowerCase(),
        created_at: t.createdAt.toISOString(),
      };
    });

    const money_message = buildMoneyMessage({
      totalEarned: wallet.totalEarned,
      withdrawable: wallet.withdrawableAmount,
      todayEarningSum,
    });

    return NextResponse.json({
      ok: true as const,
      wallet: {
        total_earned: wallet.totalEarned,
        withdrawable: wallet.withdrawableAmount,
        bonus: wallet.bonusAmount,
      },
      activity,
      money_message,
      messages: [
        money_message,
        wallet.withdrawableAmount >= 1000
          ? `You can withdraw ₹${Math.round(wallet.withdrawableAmount).toLocaleString("en-IN")} when ready.`
          : "Close one more deal to grow your withdrawable balance.",
      ],
    });
  } catch (e) {
    return handleApiError("GET /api/iceconnect/bde/wallet", e);
  }
}
