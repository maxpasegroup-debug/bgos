/**
 * PUT /api/internal/rewards/competitions/progress
 *
 * Updates the caller's progress for a competition and recalculates rankings.
 * Only the user themselves (or BOSS) can update progress.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { updateCompetitionProgress } from "@/lib/internal-rewards";
import { parseJsonBodyZod } from "@/lib/api-response";
import { SalesNetworkRole } from "@prisma/client";

const bodySchema = z.object({
  competition_id: z.string().min(1),
  progress: z.number().min(0),
  user_id: z.string().optional(),
});

export async function PUT(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const targetUserId =
    parsed.data.user_id && session.salesNetworkRole === SalesNetworkRole.BOSS
      ? parsed.data.user_id
      : session.userId;

  await updateCompetitionProgress(
    targetUserId,
    parsed.data.competition_id,
    parsed.data.progress,
  );

  return NextResponse.json({ ok: true as const });
}
