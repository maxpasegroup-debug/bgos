import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithCompany } from "@/lib/auth";
import { endOfDayLocal, startOfDayLocal } from "@/lib/hr";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  reason: z.string().trim().min(3).max(2000),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false as const, error: "Invalid JSON", code: "BAD_REQUEST" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });
  }

  const fromDate = new Date(parsed.data.fromDate);
  const toDate = new Date(parsed.data.toDate);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return NextResponse.json({ ok: false as const, error: "Invalid date", code: "VALIDATION" }, { status: 400 });
  }
  if (fromDate > toDate) {
    return NextResponse.json({ ok: false as const, error: "fromDate must be before toDate", code: "VALIDATION" }, { status: 400 });
  }

  const overlap = await (prisma as any).leaveRequest.findFirst({
    where: {
      companyId: session.companyId,
      userId: session.sub,
      status: { in: ["PENDING", "APPROVED"] },
      fromDate: { lte: endOfDayLocal(toDate) },
      toDate: { gte: startOfDayLocal(fromDate) },
    },
    select: { id: true },
  });

  if (overlap) {
    return NextResponse.json({ ok: false as const, error: "Overlapping leave request exists", code: "OVERLAP" }, { status: 409 });
  }

  const row = await (prisma as any).leaveRequest.create({
    data: {
      companyId: session.companyId,
      userId: session.sub,
      fromDate,
      toDate,
      reason: parsed.data.reason,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    ok: true as const,
    leave: {
      id: row.id,
      userId: row.userId,
      fromDate: row.fromDate.toISOString(),
      toDate: row.toDate.toISOString(),
      reason: row.reason,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    },
  });
}
