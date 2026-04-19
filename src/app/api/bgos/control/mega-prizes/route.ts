import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { IncentiveAudience, IncentiveCampaignLifecycle } from "@prisma/client";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  audience: z.nativeEnum(IncentiveAudience),
  eligibilityRules: z.string().trim().min(1).max(8000),
  prizeDescription: z.string().trim().min(1).max(8000),
  winnerRule: z.string().trim().min(1).max(4000),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  lifecycle: z.nativeEnum(IncentiveCampaignLifecycle).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;
    const items = await prisma.megaPrizeCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json({ ok: true as const, items });
  } catch (e) {
    logCaughtError("GET /api/bgos/control/mega-prizes", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load mega prizes", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;
    const parsed = await parseJsonBodyZod(request, createSchema);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;
    const row = await prisma.megaPrizeCampaign.create({
      data: {
        name: d.name,
        audience: d.audience,
        eligibilityRules: d.eligibilityRules,
        prizeDescription: d.prizeDescription,
        winnerRule: d.winnerRule,
        startDate: new Date(d.startDate),
        endDate: new Date(d.endDate),
        lifecycle: d.lifecycle ?? IncentiveCampaignLifecycle.ACTIVE,
      },
    });
    return NextResponse.json({ ok: true as const, item: row }, { status: 201 });
  } catch (e) {
    return handleApiError("POST /api/bgos/control/mega-prizes", e);
  }
}
