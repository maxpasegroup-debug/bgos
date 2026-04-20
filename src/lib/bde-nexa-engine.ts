import "server-only";

/**
 * Nexa field engine — unified user missions (see {@link ./user-mission-engine}).
 */
export {
  addProspectForBde,
  buildUnifiedNexaMessage,
  completeUserTask,
  createDailyMissionsForAllBdes,
  generateUserMission,
  logCallForToday,
  resetStreakIfYesterdayMissed,
  utcTodayDate,
  utcYesterdayDate,
} from "@/lib/user-mission-engine";

export async function ensureMissionWithTasks(userId: string, date?: Date) {
  const { generateUserMission, utcTodayDate } = await import("@/lib/user-mission-engine");
  return generateUserMission(userId, date ?? utcTodayDate());
}

export async function completeBdeTask(taskId: string, userId: string) {
  const { completeUserTask } = await import("@/lib/user-mission-engine");
  return completeUserTask(taskId, userId);
}
