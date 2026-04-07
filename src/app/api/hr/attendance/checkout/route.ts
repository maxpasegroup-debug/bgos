import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithCompany } from "@/lib/auth";
import { startOfDayLocal } from "@/lib/hr";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const now = new Date();
  const day = startOfDayLocal(now);

  const existing = await (prisma as any).attendance.findUnique({
    where: {
      companyId_userId_date: {
        companyId: session.companyId,
        userId: session.sub,
        date: day,
      },
    },
  });

  if (!existing || !existing.checkIn) {
    return NextResponse.json({ ok: false as const, error: "Check-in required first", code: "NO_CHECKIN" }, { status: 400 });
  }
  if (existing.checkOut) {
    return NextResponse.json({ ok: false as const, error: "Already checked out today", code: "ALREADY_CHECKED_OUT" }, { status: 409 });
  }

  const row = await (prisma as any).attendance.update({
    where: { id: existing.id },
    data: { checkOut: now },
  });

  return NextResponse.json({
    ok: true as const,
    attendance: {
      id: row.id,
      date: row.date.toISOString(),
      checkIn: row.checkIn?.toISOString() ?? null,
      checkOut: row.checkOut?.toISOString() ?? null,
    },
  });
}
