import "server-only";

import type { Lead, OnboardingTask } from "@prisma/client";
import { InternalSalesStage, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { internalStageToLeadStatus } from "@/lib/internal-sales-org";
import { logInternalLeadActivity } from "@/lib/internal-sales-activity";
import { listInternalTechUserIds, notifyInternalUsers } from "@/lib/internal-sales-notifications";

export type OnboardingUiStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export function onboardingUiStatus(task: Pick<OnboardingTask, "status"> | null): OnboardingUiStatus {
  if (!task) return "NOT_STARTED";
  if (task.status === "DELIVERED") return "COMPLETED";
  return "IN_PROGRESS";
}

export type OnboardingSnapshotInput = {
  companyName: string;
  ownerName: string;
  phone: string;
  email?: string | null;
  businessType?: string | null;
  teamSize?: string | null;
  leadSources?: string | null;
  problems?: string | null;
  requirements?: string | null;
  plan?: string | null;
  whatsApp?: string | null;
};

export async function createOnboardingTaskForLead(params: {
  companyId: string;
  leadId: string;
  createdByUserId: string;
  snapshot: OnboardingSnapshotInput;
  /** When true, moves lead to Closed Won and syncs CRM status. */
  closeWon: boolean;
}) {
  const { companyId, leadId, createdByUserId, snapshot, closeWon } = params;

  const task = await prisma.$transaction(async (tx) => {
    const row = await tx.onboardingTask.create({
      data: {
        companyId,
        leadId,
        status: "NEW",
        snapshotCompanyName: snapshot.companyName.trim(),
        snapshotOwnerName: snapshot.ownerName.trim(),
        snapshotPhone: snapshot.phone.trim(),
        snapshotEmail: snapshot.email?.trim() || null,
        snapshotBusinessType: snapshot.businessType?.trim() || null,
        snapshotTeamSize: snapshot.teamSize?.trim() || null,
        snapshotLeadSources: snapshot.leadSources?.trim() || null,
        snapshotProblems: snapshot.problems?.trim() || null,
        snapshotRequirements: snapshot.requirements?.trim() || null,
        snapshotPlan: snapshot.plan?.trim() || null,
        snapshotWhatsApp: snapshot.whatsApp?.trim() || null,
        createdByUserId,
      },
    });

    if (closeWon) {
      await tx.lead.update({
        where: { id: leadId },
        data: {
          internalSalesStage: InternalSalesStage.CLOSED_WON,
          status: internalStageToLeadStatus(InternalSalesStage.CLOSED_WON),
        },
      });
    }

    await logInternalLeadActivity({
      companyId,
      leadId,
      userId: createdByUserId,
      action: "ONBOARDING_STARTED",
      detail: `Onboarding started — ${snapshot.companyName}`,
      metadata: { onboardingTaskId: row.id },
    });

    return row;
  });

  const techIds = await listInternalTechUserIds(companyId);
  if (techIds.length > 0) {
    await notifyInternalUsers({
      companyId,
      userIds: techIds,
      type: "ONBOARDING_NEW",
      title: "New onboarding",
      body: `${snapshot.companyName} — ${snapshot.ownerName}. Check the onboarding queue.`,
      dedupeKey: `onboarding-new:${task.id}`,
    });
  }

  return task;
}

export function snapshotFromLead(lead: Lead): OnboardingSnapshotInput {
  return {
    companyName: lead.leadCompanyName?.trim() || lead.name,
    ownerName: lead.name,
    phone: lead.phone,
    email: lead.email,
    businessType: lead.businessType,
    teamSize: null,
    leadSources: lead.source,
    problems: null,
    requirements: null,
    plan: null,
    whatsApp: lead.phone,
  };
}

export async function ensureOnboardingOnClosedWon(params: {
  companyId: string;
  lead: Lead;
  actorUserId: string;
}) {
  const { companyId, lead, actorUserId } = params;
  const existing = await prisma.onboardingTask.findUnique({
    where: { leadId: lead.id },
  });
  if (existing) return existing;

  const snap = snapshotFromLead(lead);
  return createOnboardingTaskForLead({
    companyId,
    leadId: lead.id,
    createdByUserId: actorUserId,
    snapshot: snap,
    closeWon: false,
  });
}

export async function notifySalesOnboardingDelivered(params: {
  companyId: string;
  lead: Pick<Lead, "id" | "name" | "assignedTo">;
  taskId: string;
}) {
  const { companyId, lead } = params;
  const recipients = new Set<string>();
  if (lead.assignedTo) recipients.add(lead.assignedTo);
  const managers = await prisma.userCompany.findMany({
    where: { companyId, jobRole: { in: [UserRole.ADMIN, UserRole.MANAGER] } },
    select: { userId: true },
  });
  for (const m of managers) recipients.add(m.userId);

  if (recipients.size === 0) return;

  await notifyInternalUsers({
    companyId,
    userIds: [...recipients],
    type: "ONBOARDING_DONE",
    title: "Onboarding completed",
    body: `${lead.name} — setup delivered.`,
    dedupeKey: `onboarding-done:${lead.id}`,
  });
}
