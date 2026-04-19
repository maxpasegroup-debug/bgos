import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { NexaCompetitionMetric } from "@prisma/client";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCompanyPrograms } from "@/lib/nexa-ceo/company-boss";
import { computeCompetitionProgress } from "@/lib/nexa-ceo/competition-progress";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  reward: z.string().trim().min(1).max(2000),
  target_metric: z.nativeEnum(NexaCompetitionMetric),
  target_value: z.number().positive(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
});

/**
 * GET: active competitions + leaderboard for the tenant.
 * POST: create competition (company owner / admin).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthWithCompany(request);
    if (session instanceof NextResponse) return session;

    const companyId = session.companyId;
    const now = new Date();

    const list = await prisma.nexaCompetition.findMany({
      where: {
        companyId,
        endDate: { gte: now },
        startDate: { lte: now },
      },
      orderBy: { endDate: "asc" },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    const out = [];
    for (const c of list) {
      const myProgress = await computeCompetitionProgress(prisma, companyId, session.sub, c);
      await prisma.nexaCompetitionParticipant.upsert({
        where: {
          competitionId_userId: { competitionId: c.id, userId: session.sub },
        },
        create: {
          competitionId: c.id,
          userId: session.sub,
          progress: myProgress,
        },
        update: { progress: myProgress },
      });

      const refreshed = await prisma.nexaCompetitionParticipant.findMany({
        where: { competitionId: c.id },
        include: { user: { select: { id: true, name: true } } },
      });

      for (const p of refreshed) {
        const prog = await computeCompetitionProgress(prisma, companyId, p.userId, c);
        if (prog !== p.progress) {
          await prisma.nexaCompetitionParticipant.update({
            where: { id: p.id },
            data: { progress: prog },
          });
          p.progress = prog;
        }
      }

      const sorted = [...refreshed].sort((a, b) => b.progress - a.progress);
      const leaderboard = sorted.map((row, idx) => ({
        user_id: row.userId,
        name: row.user.name,
        progress: row.progress,
        rank: idx + 1,
      }));

      out.push({
        id: c.id,
        title: c.title,
        description: c.description,
        reward: c.reward,
        target_metric: c.targetMetric,
        target_value: c.targetValue,
        start_date: c.startDate.toISOString(),
        end_date: c.endDate.toISOString(),
        ends_in_ms: Math.max(0, c.endDate.getTime() - now.getTime()),
        leaderboard,
      });
    }

    return NextResponse.json({ ok: true as const, competitions: out });
  } catch (e) {
    logCaughtError("nexa-competitions-get", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to load competitions", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthWithCompany(request);
    if (session instanceof NextResponse) return session;

    const companyId = session.companyId;
    const can = await canManageCompanyPrograms(prisma, companyId, session.sub);
    if (!can) {
      return NextResponse.json(
        { ok: false as const, error: "Only the company owner or admin can create competitions.", code: "FORBIDDEN" },
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
        { ok: false as const, error: "end_date must be after start_date", code: "VALIDATION" },
        { status: 400 },
      );
    }

    const row = await prisma.nexaCompetition.create({
      data: {
        companyId,
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
    logCaughtError("nexa-competitions-post", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to create competition", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
