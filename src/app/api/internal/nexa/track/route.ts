/**
 * POST /api/internal/nexa/track
 *
 * Records a performance event for the authenticated internal staff member.
 * Call this from UI actions — task complete, call logged, company onboarded —
 * to increment daily/monthly activity counters used by the Nexa engine.
 *
 * Body: { event: "task_complete" | "call_made" | "company_onboarded" }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { prisma } from "@/lib/prisma";
import { trackInternalTaskComplete } from "@/lib/internal-nexa-behavior";

const bodySchema = z.object({
  event: z.enum(["task_complete", "call_made", "company_onboarded"]),
});

export async function POST(request: Request) {
  try {
    const user = requireAuth(request);
    if (user instanceof NextResponse) return user;

    const session = await requireInternalSalesSession(user);
    if (session instanceof NextResponse) return session;

    const parsed = await parseJsonBodyZod(request, bodySchema);
    if (!parsed.ok) return parsed.response;

    await trackInternalTaskComplete(prisma, session.userId, session.companyId);

    return NextResponse.json({ ok: true as const, event: parsed.data.event });
  } catch (e) {
    logCaughtError("internal-nexa-track", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to record event", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
