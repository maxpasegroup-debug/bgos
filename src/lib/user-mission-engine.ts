import "server-only";

import type { Prisma } from "@prisma/client";
import {
  BdeRewardStatus,
  IceconnectEmployeeRole,
  UserMissionStatus,
  UserMissionType,
  UserTaskStatus,
} from "@prisma/client";
import { creditBonusOnRewardUnlock, creditOnboardingDayBonus } from "@/lib/bde-wallet";
import { getOnboardingDayDef, ONBOARDING_DAY_LEAD_TARGET } from "@/lib/bde-onboarding-plan";
import { getOrCreateBdeOnboarding } from "@/lib/bde-onboarding-engine";
import { dateAtNoonUtc, utcTodayDate, utcYesterdayDate } from "@/lib/bde-time";
import { prisma } from "@/lib/prisma";

export { utcTodayDate, utcYesterdayDate } from "@/lib/bde-time";

const DAILY_LEAD_TARGET = 5;

function normalizeOnboardingRow(row: { currentDay: number; completed: boolean }) {
  if (row.currentDay > 7 || row.completed) {
    return { currentDay: Math.min(7, Math.max(1, row.currentDay)), completed: true };
  }
  return { currentDay: Math.max(1, row.currentDay), completed: false };
}

async function persistNormalizedOnboarding(userId: string) {
  const row = await getOrCreateBdeOnboarding(userId);
  const n = normalizeOnboardingRow(row);
  if (n.completed !== row.completed || n.currentDay !== row.currentDay) {
    await prisma.bdeOnboarding.update({
      where: { userId },
      data: { completed: n.completed, currentDay: n.currentDay },
    });
  }
  return prisma.bdeOnboarding.findUniqueOrThrow({ where: { userId } });
}

export type MissionSpec = {
  type: UserMissionType;
  onboardingDay: number | null;
  targetCount: number;
};

export async function resolveMissionSpec(userId: string): Promise<MissionSpec> {
  const ob = await persistNormalizedOnboarding(userId);
  if (ob.completed || ob.currentDay > 7) {
    return { type: UserMissionType.DAILY, onboardingDay: null, targetCount: DAILY_LEAD_TARGET };
  }
  const d = ob.currentDay;
  const target = ONBOARDING_DAY_LEAD_TARGET[d] ?? DAILY_LEAD_TARGET;
  return { type: UserMissionType.ONBOARDING, onboardingDay: d, targetCount: target };
}

function taskDefsForDaily(): Array<{ key: string; label: string }> {
  return [
    { key: "daily:leads", label: "Add 5 new prospects" },
    { key: "daily:follow_a", label: "Follow up warm lead #1" },
    { key: "daily:follow_b", label: "Follow up warm lead #2" },
    { key: "daily:trial", label: "Invite one prospect to trial" },
  ];
}

function taskDefsForOnboarding(day: number): Array<{ key: string; label: string }> {
  const def = getOnboardingDayDef(day);
  return def?.tasks.map((t) => ({ key: t.key, label: t.label })) ?? taskDefsForDaily();
}

function shouldAutoCompleteTask(
  taskKey: string,
  m: { completedCount: number; callsLogged: number; targetCount: number },
): boolean {
  const d1 = taskKey.match(/^d1_lead_(\d+)$/);
  if (d1) return m.completedCount >= Number(d1[1]);
  const d2 = taskKey.match(/^d2_lead_(\d+)$/);
  if (d2) return m.completedCount >= Number(d2[1]);
  const d3 = taskKey.match(/^d3_l(\d+)$/);
  if (d3) return m.completedCount >= Number(d3[1]);
  if (taskKey === "d2_calling") return m.callsLogged >= 1;
  if (taskKey === "d6_calls") return m.callsLogged >= 2;
  if (taskKey === "d6_mission") return m.completedCount >= m.targetCount && m.targetCount > 0;
  if (taskKey === "daily:leads") return m.completedCount >= DAILY_LEAD_TARGET;
  return false;
}

async function syncAutoTasksForMission(missionId: string) {
  const mission = await prisma.userMission.findUnique({
    where: { id: missionId },
    include: { tasks: true },
  });
  if (!mission) return;
  for (const t of mission.tasks) {
    if (t.status === UserTaskStatus.DONE) continue;
    if (shouldAutoCompleteTask(t.taskKey, mission)) {
      await prisma.userTask.update({
        where: { id: t.id },
        data: { status: UserTaskStatus.DONE },
      });
    }
  }
}

async function missionMeetsCompletionCriteria(missionId: string): Promise<boolean> {
  const mission = await prisma.userMission.findUnique({
    where: { id: missionId },
    include: { tasks: true },
  });
  if (!mission || mission.status === UserMissionStatus.COMPLETED) return false;
  const targetOk =
    mission.targetCount === 0 || mission.completedCount >= mission.targetCount;
  const allDone = mission.tasks.length > 0 && mission.tasks.every((t) => t.status === UserTaskStatus.DONE);
  return targetOk && allDone;
}

async function updateStreakAfterUserMissionComplete(userId: string, missionDate: Date) {
  const todayKey = dateAtNoonUtc(missionDate);
  const yesterdayKey = new Date(todayKey);
  yesterdayKey.setUTCDate(yesterdayKey.getUTCDate() - 1);

  const streak = await prisma.bdeStreak.findUnique({ where: { userId } });

  if (!streak) {
    await prisma.bdeStreak.create({
      data: { userId, currentStreak: 1, lastActiveDate: todayKey },
    });
    return;
  }

  const last = streak.lastActiveDate;
  if (!last) {
    await prisma.bdeStreak.update({
      where: { userId },
      data: { currentStreak: 1, lastActiveDate: todayKey },
    });
    return;
  }

  const lastKey = dateAtNoonUtc(last);
  if (lastKey.getTime() === todayKey.getTime()) {
    return;
  }

  const lastWasYesterday = lastKey.getTime() === yesterdayKey.getTime();
  await prisma.bdeStreak.update({
    where: { userId },
    data: {
      currentStreak: lastWasYesterday ? streak.currentStreak + 1 : 1,
      lastActiveDate: todayKey,
    },
  });
}

async function maybeUnlockRewards(userId: string) {
  const total = await prisma.bdeProspect.count({ where: { userId } });
  const milestones = [
    { at: 5, type: "milestone_5_leads", value: "₹500 bonus credit (demo)" },
    { at: 20, type: "milestone_20_leads", value: "Premium Nexa badge + priority support" },
  ];
  for (const m of milestones) {
    if (total < m.at) continue;
    await prisma.bdeReward.upsert({
      where: { userId_type: { userId, type: m.type } },
      create: {
        userId,
        type: m.type,
        value: m.value,
        status: BdeRewardStatus.UNLOCKED,
      },
      update: {
        status: BdeRewardStatus.UNLOCKED,
      },
    });
    await creditBonusOnRewardUnlock(userId, m.type);
  }
}

function specMatchesMission(
  m: {
    type: UserMissionType;
    onboardingDay: number | null;
    targetCount: number;
  },
  spec: MissionSpec,
): boolean {
  return (
    m.type === spec.type &&
    m.onboardingDay === spec.onboardingDay &&
    m.targetCount === spec.targetCount
  );
}

async function createTasksForMission(
  tx: Prisma.TransactionClient,
  userId: string,
  missionId: string,
  spec: MissionSpec,
) {
  const defs =
    spec.type === UserMissionType.ONBOARDING && spec.onboardingDay != null
      ? taskDefsForOnboarding(spec.onboardingDay)
      : taskDefsForDaily();
  await tx.userTask.createMany({
    data: defs.map((d) => ({
      userId,
      userMissionId: missionId,
      taskKey: d.key,
      label: d.label,
      status: UserTaskStatus.PENDING,
    })),
  });
}

/**
 * Ensures today's unified mission row + tasks (onboarding or daily).
 */
export async function generateUserMission(userId: string, date: Date = utcTodayDate()) {
  const spec = await resolveMissionSpec(userId);

  const existing = await prisma.userMission.findUnique({
    where: { userId_missionDate: { userId, missionDate: date } },
    include: { tasks: true },
  });

  if (!existing) {
    const created = await prisma.userMission.create({
      data: {
        userId,
        missionDate: date,
        type: spec.type,
        onboardingDay: spec.onboardingDay,
        targetCount: spec.targetCount,
        completedCount: 0,
        callsLogged: 0,
        status: UserMissionStatus.PENDING,
      },
      include: { tasks: true },
    });
    await prisma.$transaction(async (tx) => {
      await createTasksForMission(tx, userId, created.id, spec);
    });
    return prisma.userMission.findUniqueOrThrow({
      where: { id: created.id },
      include: { tasks: { orderBy: { createdAt: "asc" } } },
    });
  }

  if (!specMatchesMission(existing, spec)) {
    await prisma.$transaction(async (tx) => {
      await tx.userTask.deleteMany({ where: { userMissionId: existing.id } });
      await tx.userMission.update({
        where: { id: existing.id },
        data: {
          type: spec.type,
          onboardingDay: spec.onboardingDay,
          targetCount: spec.targetCount,
          completedCount: 0,
          callsLogged: 0,
          status: UserMissionStatus.PENDING,
        },
      });
      await createTasksForMission(tx, userId, existing.id, spec);
    });
    return prisma.userMission.findUniqueOrThrow({
      where: { id: existing.id },
      include: { tasks: { orderBy: { createdAt: "asc" } } },
    });
  }

  if (existing.tasks.length === 0) {
    await prisma.$transaction(async (tx) => {
      await createTasksForMission(tx, userId, existing.id, spec);
    });
    return prisma.userMission.findUniqueOrThrow({
      where: { id: existing.id },
      include: { tasks: { orderBy: { createdAt: "asc" } } },
    });
  }

  return prisma.userMission.findUniqueOrThrow({
    where: { id: existing.id },
    include: { tasks: { orderBy: { createdAt: "asc" } } },
  });
}

async function reshapeMissionToSpec(
  tx: Prisma.TransactionClient,
  userId: string,
  missionRowId: string,
  spec: MissionSpec,
) {
  await tx.userTask.deleteMany({ where: { userMissionId: missionRowId } });
  await tx.userMission.update({
    where: { id: missionRowId },
    data: {
      type: spec.type,
      onboardingDay: spec.onboardingDay,
      targetCount: spec.targetCount,
      completedCount: 0,
      callsLogged: 0,
      status: UserMissionStatus.PENDING,
    },
  });
  await createTasksForMission(tx, userId, missionRowId, spec);
}

async function finalizeUserMissionIfReady(missionId: string, userId: string, missionDate: Date) {
  await syncAutoTasksForMission(missionId);
  const ok = await missionMeetsCompletionCriteria(missionId);
  if (!ok) return;

  const missionBefore = await prisma.userMission.findUniqueOrThrow({ where: { id: missionId } });
  const wasOnboarding = missionBefore.type === UserMissionType.ONBOARDING;

  await prisma.$transaction(async (tx) => {
    await tx.userMission.update({
      where: { id: missionId },
      data: { status: UserMissionStatus.COMPLETED },
    });

    if (missionBefore.type === UserMissionType.ONBOARDING && missionBefore.onboardingDay != null) {
      const day = missionBefore.onboardingDay;
      await creditOnboardingDayBonus(userId, day, tx);

      const ob = await tx.bdeOnboarding.findUnique({ where: { userId } });
      if (ob && !ob.completed) {
        const nextDay = day + 1;
        if (nextDay > 7) {
          await tx.bdeOnboarding.update({
            where: { userId },
            data: { completed: true, currentDay: 7 },
          });
        } else {
          await tx.bdeOnboarding.update({
            where: { userId },
            data: { currentDay: nextDay },
          });
        }
      }
    }
  });

  await updateStreakAfterUserMissionComplete(userId, missionDate);

  if (wasOnboarding) {
    const spec = await resolveMissionSpec(userId);
    const row = await prisma.userMission.findUnique({
      where: { userId_missionDate: { userId, missionDate } },
    });
    if (row) {
      await prisma.$transaction(async (tx) => {
        await reshapeMissionToSpec(tx, userId, row.id, spec);
      });
    }
  }
}

export async function addProspectForBde(input: {
  userId: string;
  companyName: string;
  phone: string;
  location?: string | null;
}) {
  const date = utcTodayDate();
  const mission = await generateUserMission(input.userId, date);

  const prospect = await prisma.bdeProspect.create({
    data: {
      userId: input.userId,
      missionId: null,
      userMissionId: mission.id,
      companyName: input.companyName.trim().slice(0, 200),
      phone: input.phone.trim().slice(0, 40),
      location: input.location?.trim().slice(0, 200) ?? null,
    },
  });

  await prisma.userMission.update({
    where: { id: mission.id },
    data: { completedCount: { increment: 1 } },
  });

  await syncAutoTasksForMission(mission.id);
  await maybeUnlockRewards(input.userId);
  await finalizeUserMissionIfReady(mission.id, input.userId, date);

  const finalMission = await prisma.userMission.findUniqueOrThrow({ where: { id: mission.id } });
  return { prospect, mission: finalMission };
}

export async function completeUserTask(taskId: string, userId: string) {
  const t = await prisma.userTask.findFirst({
    where: { id: taskId, userId },
    include: { mission: true },
  });
  if (!t) return null;
  const updated = await prisma.userTask.update({
    where: { id: taskId },
    data: { status: UserTaskStatus.DONE },
  });
  await finalizeUserMissionIfReady(t.userMissionId, userId, t.mission.missionDate);
  return updated;
}

export async function logCallForToday(userId: string) {
  const date = utcTodayDate();
  const mission = await generateUserMission(userId, date);
  await prisma.userMission.update({
    where: { id: mission.id },
    data: { callsLogged: { increment: 1 } },
  });
  await syncAutoTasksForMission(mission.id);
  await finalizeUserMissionIfReady(mission.id, userId, date);
  return prisma.userMission.findUniqueOrThrow({ where: { id: mission.id } });
}

export async function resetStreakIfYesterdayMissed(userId: string) {
  const y = utcYesterdayDate();
  const m = await prisma.userMission.findUnique({
    where: { userId_missionDate: { userId, missionDate: y } },
  });
  if (!m || m.status === UserMissionStatus.COMPLETED) return;
  const streak = await prisma.bdeStreak.findUnique({ where: { userId } });
  if (!streak || streak.currentStreak === 0) return;
  await prisma.bdeStreak.update({
    where: { userId },
    data: { currentStreak: 0 },
  });
}

export async function createDailyMissionsForAllBdes(): Promise<{ processed: number; new_missions: number }> {
  const bdes = await prisma.user.findMany({
    where: {
      employeeSystem: "ICECONNECT",
      iceconnectEmployeeRole: IceconnectEmployeeRole.BDE,
      isActive: true,
    },
    select: { id: true },
  });

  const date = utcTodayDate();
  let newMissions = 0;

  for (const u of bdes) {
    const existed = await prisma.userMission.findUnique({
      where: { userId_missionDate: { userId: u.id, missionDate: date } },
    });
    await generateUserMission(u.id, date);
    if (!existed) newMissions++;
  }

  return { processed: bdes.length, new_missions: newMissions };
}

export function buildUnifiedNexaMessage(input: {
  mission: {
    completedCount: number;
    targetCount: number;
    status: UserMissionStatus;
    type: UserMissionType;
  };
  streak: { currentStreak: number } | null;
  yesterdayCompleted: boolean;
}): string {
  const { mission, streak, yesterdayCompleted } = input;
  const toneOnboarding = mission.type === UserMissionType.ONBOARDING;

  if (mission.status === UserMissionStatus.COMPLETED) {
    return toneOnboarding
      ? "Day mission complete — open the next checklist when you're ready for more."
      : "Mission complete — you crushed it today. Come back tomorrow for a fresh run.";
  }

  const left = mission.targetCount === 0 ? 0 : mission.targetCount - mission.completedCount;
  if (toneOnboarding) {
    if (left > 0 && left <= 2) {
      return `Let's learn step by step — ${left} more prospect${left === 1 ? "" : "s"} for today's target.`;
    }
    return "Let's learn step by step — finish the checklist and today's target.";
  }

  if (left <= 2 && left > 0) {
    return `Let's hit today's target — ${left} prospect${left === 1 ? "" : "s"} to go.`;
  }
  if (yesterdayCompleted) {
    return "Great work yesterday — keep the momentum.";
  }
  if (streak && streak.currentStreak >= 3) {
    return "Don't break your streak — one focused hour today.";
  }
  return "Let's hit today's target — knock out one task, then add a prospect.";
}
