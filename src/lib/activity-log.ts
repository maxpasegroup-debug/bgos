import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

/** Stable event kinds for filters, analytics, and AI context. */
export const ACTIVITY_TYPES = {
  LEAD_CREATED: "LEAD_CREATED",
  LEAD_STATUS_CHANGED: "LEAD_STATUS_CHANGED",
  LEAD_ASSIGNED: "LEAD_ASSIGNED",
  TASK_COMPLETED: "TASK_COMPLETED",
  DEAL_CLOSED: "DEAL_CLOSED",
  SALES_BOOSTER_UPGRADE_REQUEST: "SALES_BOOSTER_UPGRADE_REQUEST",
  AUTOMATION_SIMULATED: "AUTOMATION_SIMULATED",
  TEAM_MEMBER_UPDATED: "TEAM_MEMBER_UPDATED",
  TEAM_MEMBER_DELETED: "TEAM_MEMBER_DELETED",
  TEAM_PASSWORD_RESET: "TEAM_PASSWORD_RESET",
  CLIENT_COMPANY_UPDATED: "CLIENT_COMPANY_UPDATED",
  CLIENT_COMPANY_ARCHIVED: "CLIENT_COMPANY_ARCHIVED",
  CLIENT_COMPANY_DELETED: "CLIENT_COMPANY_DELETED",
} as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES];

type ActivityDb = Pick<PrismaClient, "activityLog">;

export async function logActivity(
  db: ActivityDb,
  input: {
    companyId: string;
    userId: string | null;
    type: string;
    message: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await db.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      type: input.type,
      message: input.message,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });
}
