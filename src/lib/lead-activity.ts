import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";

export const LEAD_ACTIVITY = {
  CREATED: ACTIVITY_TYPES.LEAD_CREATED,
  STATUS_CHANGED: ACTIVITY_TYPES.LEAD_STATUS_CHANGED,
  ASSIGNED: ACTIVITY_TYPES.LEAD_ASSIGNED,
} as const;

type ActivityClient = Pick<PrismaClient, "activityLog">;

export async function logLeadActivity(
  db: ActivityClient,
  input: {
    companyId: string;
    userId: string;
    type: string;
    message: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await logActivity(db, input);
}
