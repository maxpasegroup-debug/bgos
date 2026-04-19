import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { NexaCompetitionMetric } from "@prisma/client";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { canManageCompanyPrograms } from "@/lib/nexa-ceo/company-boss";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  reward: z.string().trim().min(1).max(2000),
  target_metric: z.nativeEnum(NexaCompetitionMetric),
  target_value: z.number().positive(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
});

export async function POST(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const org = await getOrCreateInternalSalesCompanyId();
    if ("error" in org) {
      return NextResponse.json(
        { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
        { status: 500 },
      );
    }

    const can = await canManageCompanyPrograms(prisma, org.companyId, session.sub);
    if (!can) {
      return NextResponse.json(
        { ok: false as const, error: "Only org admins can create competitions.", code: "FORBIDDEN" as const },
        { status: 403 },
      );
    }

    const parsed = await parseJsonBodyZod(request, createSchema);
    if (!parsed.ok) return parsed.response;

    const b = parsed.data;
    const startDate = new Date(b.start_date);
    const endDate = new Date(b.end_date);
    if (!(endDate > startDate)) {
      return NextResponse.json(
        { ok: false as const, error: "end_date must be after start_date", code: "VALIDATION" as const },
        { status: 400 },
      );
    }

    const row = await prisma.nexaCompetition.create({
      data: {
        companyId: org.companyId,
        title: b.title,
        description: b.description ?? null,
        reward: b.reward,
        targetMetric: b.target_metric,
        targetValue: b.target_value,
        startDate,
        endDate,
        createdById: session.sub,
      },
    });

    return NextResponse.json({
      ok: true as const,
      competition: {
        id: row.id,
        title: row.title,
        target_metric: row.targetMetric,
        target_value: row.targetValue,
        start_date: row.startDate.toISOString(),
        end_date: row.endDate.toISOString(),
      },
    });
  } catch (e) {
    logCaughtError("POST /api/internal/programs/competitions", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to create competition", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
