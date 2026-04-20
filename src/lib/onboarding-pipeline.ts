import "server-only";

import {
  IceconnectEmployeeRole,
  OnboardingPipelineSourceType,
  OnboardingPipelineStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TxClient = Prisma.TransactionClient;

async function loadRsmPool(tx: TxClient) {
  return tx.user.findMany({
    where: {
      isActive: true,
      employeeSystem: "ICECONNECT",
      iceconnectEmployeeRole: IceconnectEmployeeRole.RSM,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function pickRsmForInbound(tx: TxClient): Promise<string | null> {
  const rsms = await loadRsmPool(tx);
  if (rsms.length === 0) return null;

  const lastAssigned = await tx.onboardingPipeline.findFirst({
    where: { assignedRsmId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { assignedRsmId: true },
  });

  if (!lastAssigned?.assignedRsmId) return rsms[0]!.id;
  const idx = rsms.findIndex((r) => r.id === lastAssigned.assignedRsmId);
  if (idx < 0) return rsms[0]!.id;
  return rsms[(idx + 1) % rsms.length]!.id;
}

export async function createInboundOnboardingPipeline(input: {
  tx: TxClient;
  companyId: string;
  companyName: string;
  sourceUserId: string;
}) {
  const assignedRsmId = await pickRsmForInbound(input.tx);
  const company = await input.tx.company.findUnique({
    where: { id: input.companyId },
    select: { dashboardConfig: true },
  });
  const prev =
    company?.dashboardConfig &&
    typeof company.dashboardConfig === "object" &&
    !Array.isArray(company.dashboardConfig)
      ? (company.dashboardConfig as Record<string, unknown>)
      : {};
  await input.tx.company.update({
    where: { id: input.companyId },
    data: {
      dashboardConfig: {
        ...prev,
        onboardingStatus: "under_review",
      },
    },
  });

  return input.tx.onboardingPipeline.create({
    data: {
      companyId: input.companyId,
      companyName: input.companyName,
      sourceType: OnboardingPipelineSourceType.INBOUND,
      sourceUserId: input.sourceUserId,
      assignedRsmId,
      status: assignedRsmId ? OnboardingPipelineStatus.ASSIGNED : OnboardingPipelineStatus.NEW,
      notes: assignedRsmId
        ? "Inbound onboarding created and auto-assigned to RSM."
        : "Inbound onboarding created. No active RSM found for assignment.",
    },
  });
}

export async function markCompanyOnboardingCompleted(companyId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: { dashboardConfig: true, ownerId: true },
    });
    if (!company) return;

    const prev =
      company.dashboardConfig &&
      typeof company.dashboardConfig === "object" &&
      !Array.isArray(company.dashboardConfig)
        ? (company.dashboardConfig as Record<string, unknown>)
        : {};

    await tx.company.update({
      where: { id: companyId },
      data: {
        dashboardConfig: {
          ...prev,
          onboardingStatus: "completed",
          onboardingCompletedAt: new Date().toISOString(),
        },
      },
    });

    await tx.user.updateMany({
      where: {
        id: company.ownerId,
        workspaceActivatedAt: null,
      },
      data: { workspaceActivatedAt: new Date() },
    });
  });
}
