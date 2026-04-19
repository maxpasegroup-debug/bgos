import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { parseJsonBodyZod } from "@/lib/api-response";
import { approveWithdrawal, payWithdrawal } from "@/lib/internal-withdrawals";
import { SalesNetworkRole } from "@prisma/client";

const bodySchema = z.object({
  withdrawal_id: z.string().min(1),
  /** If true, marks the withdrawal as PAID (bank transfer confirmed). Defaults to APPROVED only. */
  mark_paid: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  if (session.salesNetworkRole !== SalesNetworkRole.BOSS) {
    return NextResponse.json(
      { ok: false as const, error: "Only BOSS can approve withdrawals.", code: "FORBIDDEN" as const },
      { status: 403 },
    );
  }

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    if (parsed.data.mark_paid) {
      // Try approve first (idempotent path: already approved → go straight to pay)
      try {
        await approveWithdrawal(parsed.data.withdrawal_id, session.userId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        // INVALID_STATUS:APPROVED means it's already approved — that's fine, continue to pay
        if (!msg.startsWith("INVALID_STATUS:APPROVED")) throw e;
      }
      await payWithdrawal(parsed.data.withdrawal_id, session.userId);
      return NextResponse.json({ ok: true as const, status: "PAID" });
    }

    await approveWithdrawal(parsed.data.withdrawal_id, session.userId);
    return NextResponse.json({ ok: true as const, status: "APPROVED" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "WITHDRAWAL_NOT_FOUND") {
      return NextResponse.json(
        { ok: false as const, error: "Withdrawal not found.", code: "NOT_FOUND" as const },
        { status: 404 },
      );
    }
    if (msg.startsWith("INVALID_STATUS")) {
      return NextResponse.json(
        { ok: false as const, error: `Cannot approve — current status: ${msg.split(":")[1]}.`, code: "INVALID_STATUS" as const },
        { status: 409 },
      );
    }
    console.error("[withdrawal/approve] error:", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to approve withdrawal." },
      { status: 500 },
    );
  }
}
