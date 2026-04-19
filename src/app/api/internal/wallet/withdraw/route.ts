import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { parseJsonBodyZod } from "@/lib/api-response";
import {
  requestWithdrawal,
  MIN_WITHDRAWAL_INR,
  MAX_WITHDRAWAL_INR,
} from "@/lib/internal-withdrawals";

const bodySchema = z.object({
  amount: z
    .number()
    .int({ message: "Amount must be a whole number in INR" })
    .min(MIN_WITHDRAWAL_INR)
    .max(MAX_WITHDRAWAL_INR),
});

export async function POST(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { withdrawalId } = await requestWithdrawal(session.userId, parsed.data.amount);
    return NextResponse.json({ ok: true as const, withdrawalId }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "AGREEMENT_NOT_ACCEPTED") {
      return NextResponse.json(
        { ok: false as const, error: "You must accept the BDE Agreement before withdrawing.", code: "AGREEMENT_REQUIRED" as const },
        { status: 403 },
      );
    }
    if (msg === "INSUFFICIENT_WITHDRAWABLE_BALANCE") {
      return NextResponse.json(
        { ok: false as const, error: "Insufficient withdrawable balance.", code: "INSUFFICIENT_BALANCE" as const },
        { status: 422 },
      );
    }
    if (msg === "WITHDRAWAL_ALREADY_PENDING") {
      return NextResponse.json(
        { ok: false as const, error: "You already have a pending withdrawal request.", code: "DUPLICATE_REQUEST" as const },
        { status: 409 },
      );
    }
    if (msg.startsWith("AMOUNT_TOO_LOW")) {
      return NextResponse.json(
        { ok: false as const, error: `Minimum withdrawal is ₹${MIN_WITHDRAWAL_INR}.`, code: "AMOUNT_TOO_LOW" as const },
        { status: 422 },
      );
    }
    if (msg.startsWith("AMOUNT_TOO_HIGH")) {
      return NextResponse.json(
        { ok: false as const, error: `Maximum withdrawal is ₹${MAX_WITHDRAWAL_INR}.`, code: "AMOUNT_TOO_HIGH" as const },
        { status: 422 },
      );
    }
    console.error("[withdraw] error:", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to process withdrawal request." },
      { status: 500 },
    );
  }
}
