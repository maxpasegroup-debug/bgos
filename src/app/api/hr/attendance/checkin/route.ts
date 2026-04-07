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

  if (existing?.checkIn) {
    return NextResponse.json({ ok: false as const, error: "Already checked in today", code: "ALREADY_CHECKED_IN" }, { status: 409 });
  }

  const row = existing
    ? await (prisma as any).attendance.update({
        where: { id: existing.id },
        data: { checkIn: now },
      })
    : await (prisma as any).attendance.create({
        data: {
          companyId: session.companyId,
          userId: session.sub,
          date: day,
          checkIn: now,
        },
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
