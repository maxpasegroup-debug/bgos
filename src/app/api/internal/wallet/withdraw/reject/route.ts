import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { parseJsonBodyZod } from "@/lib/api-response";
import { rejectWithdrawal } from "@/lib/internal-withdrawals";
import { SalesNetworkRole } from "@prisma/client";

const bodySchema = z.object({
  withdrawal_id: z.string().min(1),
  reason: z.string().min(1).max(300).default("Rejected by admin"),
});

export async function POST(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  if (session.salesNetworkRole !== SalesNetworkRole.BOSS) {
    return NextResponse.json(
      { ok: false as const, error: "Only BOSS can reject withdrawals.", code: "FORBIDDEN" as const },
      { status: 403 },
    );
  }

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    await rejectWithdrawal(
      parsed.data.withdrawal_id,
      session.userId,
      parsed.data.reason,
    );
    return NextResponse.json({ ok: true as const, status: "REJECTED" });
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
        { ok: false as const, error: `Cannot reject — current status: ${msg.split(":")[1]}.`, code: "INVALID_STATUS" as const },
        { status: 409 },
      );
    }
    console.error("[withdrawal/reject] error:", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to reject withdrawal." },
      { status: 500 },
    );
  }
}
