import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

const bodySchema = z.object({
  transactionIds: z.array(z.string().min(1)).min(1),
});

/** Mark released commissions as paid out (external transfer) and deduct partner balance. */
export async function POST(request: NextRequest) {
  try {
    const session = requireSuperBossApi(request);
    if (session instanceof NextResponse) return session;
    const parsed = await parseJsonBodyZod(request, bodySchema);
    if (!parsed.ok) return parsed.response;

    const marked = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const tid of parsed.data.transactionIds) {
        const row = await tx.commissionTransaction.findUnique({
          where: { id: tid },
          select: { id: true, partnerId: true, amount: true, status: true },
        });
        if (!row || row.status !== "RELEASED") continue;

        await tx.commissionTransaction.update({
          where: { id: row.id },
          data: { status: "PAID_OUT" },
        });
        await tx.wallet.update({
          where: { partnerId: row.partnerId },
          data: {
            balance: { decrement: row.amount },
          },
        });
        count += 1;
      }
      return count;
    });

    return NextResponse.json({ ok: true as const, marked });
  } catch (e) {
    logCaughtError("POST wallet payout", e);
    return NextResponse.json(
      { ok: false as const, error: "Payout mark failed", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
