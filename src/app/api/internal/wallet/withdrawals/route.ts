import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { getUserWithdrawals, getAllWithdrawals, InternalWithdrawalStatus } from "@/lib/internal-withdrawals";
import { SalesNetworkRole } from "@prisma/client";

export async function GET(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  // BOSS sees all withdrawals; everyone else sees only their own
  if (session.salesNetworkRole === SalesNetworkRole.BOSS) {
    const { searchParams } = new URL(request.url);
    const rawStatus = searchParams.get("status")?.toUpperCase();
    const statusFilter = Object.values(InternalWithdrawalStatus).includes(
      rawStatus as InternalWithdrawalStatus,
    )
      ? (rawStatus as InternalWithdrawalStatus)
      : undefined;

    const withdrawals = await getAllWithdrawals(statusFilter, 100);
    return NextResponse.json({ ok: true as const, withdrawals });
  }

  const withdrawals = await getUserWithdrawals(session.userId, 30);
  return NextResponse.json({ ok: true as const, withdrawals });
}
