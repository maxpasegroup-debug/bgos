/**
 * POST /api/internal/wallet/credit
 *
 * Internal-only endpoint for crediting a wallet (used by the sales engine
 * and other server-side processes — NOT callable by BDE/BDM from the UI).
 *
 * Access: BOSS only (or internal server-to-server via trusted auth).
 * Commission breakdown is never accepted or returned.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { creditWallet, InternalWalletTxType } from "@/lib/internal-wallet";
import { SalesNetworkRole } from "@prisma/client";
import { parseJsonBodyZod } from "@/lib/api-response";

const bodySchema = z.object({
  user_id: z.string().min(1),
  amount: z.number().positive(),
  type: z.nativeEnum(InternalWalletTxType),
  reference_id: z.string().optional(),
  note: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  // Only BOSS may call this endpoint directly
  if (session.salesNetworkRole !== SalesNetworkRole.BOSS) {
    return NextResponse.json(
      { ok: false as const, error: "Forbidden", code: "FORBIDDEN" as const },
      { status: 403 },
    );
  }

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { user_id, amount, type, reference_id, note } = parsed.data;

  try {
    const { txId, skipped } = await creditWallet({
      userId: user_id,
      amount,
      type,
      referenceId: reference_id,
      note,
    });

    return NextResponse.json(
      { ok: true as const, txId, skipped },
      { status: skipped ? 200 : 201 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false as const, error: msg },
      { status: 500 },
    );
  }
}
