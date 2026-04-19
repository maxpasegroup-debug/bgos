import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { IncentiveAudience } from "@prisma/client";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
  audience: z.nativeEnum(IncentiveAudience).default(IncentiveAudience.BOTH),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;
    const items = await prisma.offerAnnouncement.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ ok: true as const, items });
  } catch (e) {
    logCaughtError("GET /api/bgos/control/offers", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load announcements", code: "SERVER_ERROR" as const },
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
    const row = await prisma.offerAnnouncement.create({
      data: {
        title: d.title,
        body: d.body,
        audience: d.audience,
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        isActive: d.isActive ?? true,
      },
    });
    return NextResponse.json({ ok: true as const, item: row }, { status: 201 });
  } catch (e) {
    return handleApiError("POST /api/bgos/control/offers", e);
  }
}
