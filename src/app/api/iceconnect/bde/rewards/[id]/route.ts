import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { BdeRewardStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireBde } from "@/lib/onboarding-request-guards";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const gate = requireBde(session);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;

  try {
    const row = await prisma.bdeReward.findFirst({
      where: { id, userId: session.sub },
    });
    if (!row) {
      return NextResponse.json({ ok: false as const, error: "Not found" }, { status: 404 });
    }
    if (row.status === BdeRewardStatus.LOCKED) {
      return NextResponse.json({ ok: false as const, error: "Reward still locked" }, { status: 409 });
    }
    if (row.status === BdeRewardStatus.REVEALED) {
      return NextResponse.json({ ok: false as const, error: "Already revealed" }, { status: 409 });
    }

    const updated = await prisma.bdeReward.update({
      where: { id },
      data: { status: BdeRewardStatus.REVEALED },
    });

    return NextResponse.json({
      ok: true as const,
      reward: {
        id: updated.id,
        type: updated.type,
        value: updated.value,
        status: updated.status.toLowerCase(),
      },
    });
  } catch (e) {
    return handleApiError("PATCH /api/iceconnect/bde/rewards/[id]", e);
  }
}
