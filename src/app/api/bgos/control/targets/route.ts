import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  TargetAssignScope,
  TargetDurationPreset,
  TargetMetricType,
  TargetRoleCategory,
} from "@prisma/client";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  roleCategory: z.nativeEnum(TargetRoleCategory),
  durationPreset: z.nativeEnum(TargetDurationPreset),
  metricType: z.nativeEnum(TargetMetricType),
  targetNumber: z.number().finite().nonnegative(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  assignScope: z.nativeEnum(TargetAssignScope),
  assigneeUserId: z.string().trim().optional(),
  departmentLabel: z.string().trim().max(120).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;
    const items = await prisma.targetCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json({ ok: true as const, items });
  } catch (e) {
    logCaughtError("GET /api/bgos/control/targets", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load targets", code: "SERVER_ERROR" as const },
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
    const row = await prisma.targetCampaign.create({
      data: {
        title: d.title,
        roleCategory: d.roleCategory,
        durationPreset: d.durationPreset,
        metricType: d.metricType,
        targetNumber: d.targetNumber,
        startDate: new Date(d.startDate),
        endDate: new Date(d.endDate),
        assignScope: d.assignScope,
        assigneeUserId: d.assigneeUserId?.trim() || null,
        departmentLabel: d.departmentLabel?.trim() || null,
      },
    });
    return NextResponse.json({ ok: true as const, item: row }, { status: 201 });
  } catch (e) {
    return handleApiError("POST /api/bgos/control/targets", e);
  }
}
