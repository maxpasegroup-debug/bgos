/**
 * POST /api/internal/rewards/reveal
 *
 * Reveals a scratch card / reward claim.
 * - Validates ownership.
 * - Returns the backend-generated value.
 * - Credits wallet bonus_balance.
 * - Never accepts a value from the client.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { revealClaim } from "@/lib/internal-rewards";
import { parseJsonBodyZod } from "@/lib/api-response";

const bodySchema = z.object({
  claim_id: z.string().min(1),
});

export async function POST(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { value, alreadyRevealed } = await revealClaim(
      session.userId,
      parsed.data.claim_id,
    );

    return NextResponse.json({
      ok: true as const,
      value,
      alreadyRevealed,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "CLAIM_NOT_FOUND" ? 404 : 500;
    return NextResponse.json(
      { ok: false as const, error: msg },
      { status },
    );
  }
}
