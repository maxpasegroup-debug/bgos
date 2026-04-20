import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { UserMissionStatus, UserMissionType } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireBde } from "@/lib/onboarding-request-guards";
import {
  buildUnifiedNexaMessage,
  generateUserMission,
  resetStreakIfYesterdayMissed,
  utcTodayDate,
  utcYesterdayDate,
} from "@/lib/user-mission-engine";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const gate = requireBde(session);
  if (gate instanceof NextResponse) return gate;

  const userId = session.sub;

  try {
    await resetStreakIfYesterdayMissed(userId);

    const mission = await generateUserMission(userId, utcTodayDate());
    const [streak, rewards, recentProspects, yMission] = await Promise.all([
      prisma.bdeStreak.findUnique({ where: { userId } }),
      prisma.bdeReward.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.bdeProspect.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          companyName: true,
          phone: true,
          location: true,
          pipelineStage: true,
          createdAt: true,
        },
      }),
      prisma.userMission.findUnique({
        where: { userId_missionDate: { userId, missionDate: utcYesterdayDate() } },
      }),
    ]);

    const yesterdayCompleted = yMission?.status === UserMissionStatus.COMPLETED;

    const smart = buildUnifiedNexaMessage({
      mission: {
        completedCount: mission.completedCount,
        targetCount: mission.targetCount,
        status: mission.status,
        type: mission.type,
      },
      streak: streak ? { currentStreak: streak.currentStreak } : null,
      yesterdayCompleted,
    });

    const missionTitle =
      mission.type === UserMissionType.ONBOARDING && mission.onboardingDay != null
        ? `Day ${mission.onboardingDay} mission`
        : "Today's mission";

    return NextResponse.json({
      ok: true as const,
      mission: {
        id: mission.id,
        date: mission.missionDate.toISOString().slice(0, 10),
        target_prospects: mission.targetCount,
        completed_count: mission.completedCount,
        calls_logged: mission.callsLogged,
        status: mission.status.toLowerCase(),
        kind: mission.type.toLowerCase(),
        onboarding_day: mission.onboardingDay,
        title: missionTitle,
      },
      tasks: mission.tasks.map((t) => ({
        id: t.id,
        task_text: t.label,
        status: t.status.toLowerCase(),
      })),
      streak: streak
        ? { current_streak: streak.currentStreak, last_active: streak.lastActiveDate?.toISOString().slice(0, 10) ?? null }
        : { current_streak: 0, last_active: null },
      rewards: rewards.map((r) => ({
        id: r.id,
        type: r.type,
        value: r.value,
        status: r.status.toLowerCase(),
      })),
      prospects: recentProspects.map((p) => ({
        id: p.id,
        company_name: p.companyName,
        phone: p.phone,
        location: p.location,
        pipeline_stage: p.pipelineStage.toLowerCase(),
        created_at: p.createdAt.toISOString(),
      })),
      smart_message: smart,
    });
  } catch (e) {
    return handleApiError("GET /api/iceconnect/bde/dashboard", e);
  }
}
