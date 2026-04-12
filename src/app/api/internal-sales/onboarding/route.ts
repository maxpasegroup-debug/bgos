import type { NextRequest } from "next/server";
import { InternalSalesStage, TechPipelineStage, UserRole } from "@prisma/client";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { assertInternalSalesSession } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";
import { orderedPipelineStages, pipelineStageLabel, techPriorityLabel } from "@/lib/tech-pipeline-sync";

function canViewOnboardingQueue(role: UserRole) {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.MANAGER ||
    role === UserRole.TECH_HEAD ||
    role === UserRole.TECH_EXECUTIVE ||
    role === UserRole.OPERATIONS_HEAD ||
    role === UserRole.SITE_ENGINEER ||
    role === UserRole.PRO ||
    role === UserRole.INSTALLATION_TEAM
  );
}

function prioritySortKey(p: import("@prisma/client").TechQueuePriority): number {
  if (p === "CRITICAL") return 0;
  if (p === "HIGH") return 1;
  return 2;
}

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (!canViewOnboardingQueue(session.role)) {
    return jsonError(403, "FORBIDDEN", "Tech or manager access only");
  }

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  const tasks = await prisma.onboardingTask.findMany({
    where: {
      companyId: ctx.companyId,
      lead: {
        internalSalesStage: {
          in: [InternalSalesStage.SENT_TO_TECH, InternalSalesStage.TECH_READY],
        },
      },
    },
    include: {
      lead: { select: { id: true, name: true, phone: true } },
      creator: { select: { id: true, name: true } },
    },
  });

  tasks.sort((a, b) => {
    const po = prioritySortKey(a.techQueuePriority) - prioritySortKey(b.techQueuePriority);
    if (po !== 0) return po;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const stageList = orderedPipelineStages();
  const byStage = new Map<TechPipelineStage, typeof tasks>();
  for (const s of stageList) byStage.set(s, []);

  for (const t of tasks) {
    const list = byStage.get(t.pipelineStage);
    if (list) list.push(t);
    else byStage.get(TechPipelineStage.RECEIVED)!.push(t);
  }

  const queue = stageList.map((key) => ({
    key,
    label: pipelineStageLabel(key),
    tasks: (byStage.get(key) ?? []).map((t) => ({
      id: t.id,
      status: t.status,
      pipelineStage: t.pipelineStage,
      techQueuePriority: t.techQueuePriority,
      priorityLabel: techPriorityLabel(t.techQueuePriority),
      leadOnboardingType: t.leadOnboardingType,
      companyName: t.snapshotCompanyName,
      ownerName: t.snapshotOwnerName,
      phone: t.snapshotPhone,
      lead: t.lead,
      creator: t.creator,
      updatedAt: t.updatedAt.toISOString(),
    })),
  }));

  return jsonSuccess({ queue });
}
