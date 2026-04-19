/**
 * GET  /api/internal/rewards/competitions  — list active competitions + my progress
 * POST /api/internal/rewards/competitions  — create new competition (BOSS only)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { getActiveCompetitions } from "@/lib/internal-rewards";
import { SalesNetworkRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseJsonBodyZod } from "@/lib/api-response";

export async function GET(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  const competitions = await getActiveCompetitions(session.userId);

  return NextResponse.json({ ok: true as const, competitions });
}

// --------------------------------------------------------------------------

const createSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  target_type: z.enum(["POINTS", "SALES", "REVENUE"]),
  target_value: z.number().positive(),
  reward_type: z.enum(["CASH", "GIFT", "POINTS_BONUS"]),
  reward_value: z.number().min(0).default(0),
  reward_note: z.string().max(200).optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
});

export async function POST(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  if (session.salesNetworkRole !== SalesNetworkRole.BOSS) {
    return NextResponse.json(
      { ok: false as const, error: "Only BOSS can create competitions", code: "FORBIDDEN" as const },
      { status: 403 },
    );
  }

  const parsed = await parseJsonBodyZod(request, createSchema);
  if (!parsed.ok) return parsed.response;

  const d = parsed.data;
  const comp = await prisma.internalCompetition.create({
    data: {
      title: d.title,
      description: d.description,
      targetType: d.target_type,
      targetValue: d.target_value,
      rewardType: d.reward_type,
      rewardValue: d.reward_value,
      rewardNote: d.reward_note,
      startDate: new Date(d.start_date),
      endDate: new Date(d.end_date),
      createdById: session.userId,
    },
    select: { id: true, title: true },
  });

  return NextResponse.json(
    { ok: true as const, id: comp.id, title: comp.title },
    { status: 201 },
  );
}
