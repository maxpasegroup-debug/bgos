import "server-only";

import { CompanyBusinessType, IceconnectMetroStage, InternalSalesStage, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pickNextTechUserId, listWorkflowTechUserIds } from "@/lib/onboarding-workflow-assign";
import { listInternalManagerUserIds, notifyInternalUsers } from "@/lib/internal-sales-notifications";

/** Move DRAFT or NEEDS_INFO → SUBMITTED, assign tech, create tech task, notify. */
export async function finalizeSubmissionToSubmitted(submissionId: string): Promise<void> {
  const row = await prisma.onboardingSubmission.findUnique({
    where: { id: submissionId },
    include: {
      company: { select: { id: true, businessType: true } },
    },
  });
  if (!row) throw new Error("NOT_FOUND");
  if (row.status !== "DRAFT" && row.status !== "NEEDS_INFO") {
    throw new Error("INVALID_STATUS");
  }

  const internal = await prisma.company.findFirst({
    where: { internalSalesOrg: true },
    select: { id: true },
  });

  const useInternalPool =
    row.company.businessType === CompanyBusinessType.CUSTOM && Boolean(internal?.id);
  const techPoolCompanyId = useInternalPool ? internal!.id : row.companyId;
  const notifyCompanyId = techPoolCompanyId;

  let techId = row.assignedTechUserId;
  if (!techId) {
    techId = await pickNextTechUserId(row.companyId, { techPoolCompanyId });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.onboardingSubmission.update({
      where: { id: submissionId },
      data: {
        status: "SUBMITTED",
        ...(techId ? { assignedTechUserId: techId } : {}),
      },
    }),
    prisma.onboardingSubmissionTechTask.upsert({
      where: { submissionId },
      create: { submissionId, status: "NEW" },
      update: { status: "NEW" },
    }),
    ...(row.leadId
      ? [
          prisma.lead.updateMany({
            where: {
              id: row.leadId,
              status: { not: LeadStatus.LOST },
            },
            data: {
              iceconnectMetroStage: IceconnectMetroStage.ONBOARDING,
              internalSalesStage: InternalSalesStage.SENT_TO_TECH,
              internalStageUpdatedAt: now,
            },
          }),
        ]
      : []),
  ]);

  const notifyTech = techId
    ? [techId]
    : await listWorkflowTechUserIds(techPoolCompanyId);
  if (notifyTech.length > 0) {
    await notifyInternalUsers({
      companyId: notifyCompanyId,
      userIds: notifyTech,
      type: "ONBOARDING_WORKFLOW_SUBMITTED",
      title:
        row.company.businessType === CompanyBusinessType.CUSTOM
          ? "Custom build — requirements submitted"
          : "Onboarding form submitted",
      body: "Review the onboarding queue.",
      dedupeKey: `workflow-sub-${submissionId}`,
    });
  }

  if (useInternalPool && internal?.id) {
    const mgr = await listInternalManagerUserIds(internal.id);
    if (mgr.length > 0) {
      await notifyInternalUsers({
        companyId: internal.id,
        userIds: mgr,
        type: "ONBOARDING_CUSTOM_SUBMITTED",
        title: "Custom onboarding submitted",
        body: "A client completed the custom requirements form — internal review.",
        dedupeKey: `workflow-custom-${submissionId}`,
      });
    }
  } else {
    const salesIds = new Set<string>();
    if (row.filledByUserId) salesIds.add(row.filledByUserId);
    for (const m of await listInternalManagerUserIds(row.companyId)) salesIds.add(m);
    if (salesIds.size > 0) {
      await notifyInternalUsers({
        companyId: row.companyId,
        userIds: [...salesIds],
        type: "ONBOARDING_WORKFLOW_SUBMITTED_ACK",
        title: "Onboarding submitted",
        body: "Your onboarding was sent to tech.",
        dedupeKey: `workflow-ack-${submissionId}`,
      });
    }
  }
}
