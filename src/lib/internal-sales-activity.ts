import "server-only";

import { prisma } from "@/lib/prisma";

export const INTERNAL_ACTIVITY = {
  CREATED: "CREATED",
  ASSIGNED: "ASSIGNED",
  CALL: "CALL",
  NOTE: "NOTE",
  STAGE: "STAGE",
  FOLLOW_UP: "FOLLOW_UP",
  ONBOARDING_STARTED: "ONBOARDING_STARTED",
  ONBOARDING_STATUS: "ONBOARDING_STATUS",
} as const;

export async function logInternalLeadActivity(params: {
  companyId: string;
  leadId: string;
  userId: string | null;
  action: string;
  detail: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.internalLeadActivity.create({
    data: {
      companyId: params.companyId,
      leadId: params.leadId,
      userId: params.userId ?? undefined,
      action: params.action,
      detail: params.detail,
      metadata: params.metadata as object | undefined,
    },
  });
}
