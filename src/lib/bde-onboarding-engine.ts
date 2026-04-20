import "server-only";

import { UserMissionStatus, UserMissionType } from "@prisma/client";
import { BDE_ONBOARDING_TOTAL_DAYS } from "@/lib/bde-onboarding-plan";
import { utcTodayDate } from "@/lib/bde-time";
import { prisma } from "@/lib/prisma";

export async function getOrCreateBdeOnboarding(userId: string) {
  return prisma.bdeOnboarding.upsert({
    where: { userId },
    create: {
      userId,
      currentDay: 1,
      completed: false,
      progressJson: {},
    },
    update: {},
  });
}

/** For RSM/BDM reports — does not create onboarding rows. */
export async function getBdeOnboardingSnapshotForUser(userId: string): Promise<{
  current_day: number;
  completed: boolean;
  progress_pct: number;
  started_at: string | null;
}> {
  const row = await prisma.bdeOnboarding.findUnique({ where: { userId } });
  if (!row) {
    return {
      current_day: 1,
      completed: false,
      progress_pct: 0,
      started_at: null,
    };
  }
  if (row.completed) {
    return {
      current_day: BDE_ONBOARDING_TOTAL_DAYS,
      completed: true,
      progress_pct: 100,
      started_at: row.startedAt.toISOString(),
    };
  }
  const d = Math.min(Math.max(1, row.currentDay), BDE_ONBOARDING_TOTAL_DAYS);
  const um = await prisma.userMission.findUnique({
    where: { userId_missionDate: { userId, missionDate: utcTodayDate() } },
  });
  let dayFrac = 0;
  if (
    um?.type === UserMissionType.ONBOARDING &&
    um.onboardingDay === d &&
    um.targetCount > 0
  ) {
    dayFrac = Math.min(1, um.completedCount / um.targetCount);
  } else if (um?.type === UserMissionType.ONBOARDING && um.status === UserMissionStatus.COMPLETED) {
    dayFrac = 1;
  }
  const base = ((d - 1) / BDE_ONBOARDING_TOTAL_DAYS) * 100;
  const progress_pct = Math.min(100, Math.round(base + (dayFrac * 100) / BDE_ONBOARDING_TOTAL_DAYS));

  return {
    current_day: d,
    completed: false,
    progress_pct,
    started_at: row.startedAt.toISOString(),
  };
}
