import type { NextRequest } from "next/server";
import { OnboardingTaskStatus } from "@prisma/client";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { assertInternalSalesSession } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";
import { UserRole } from "@prisma/client";
import { jsonError } from "@/lib/api-response";

function canViewOnboardingQueue(role: UserRole) {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.MANAGER ||
    role === UserRole.OPERATIONS_HEAD ||
    role === UserRole.SITE_ENGINEER ||
    role === UserRole.PRO ||
    role === UserRole.INSTALLATION_TEAM
  );
}

const STAGES: { key: OnboardingTaskStatus; label: string }[] = [
  { key: OnboardingTaskStatus.NEW, label: "New" },
  { key: OnboardingTaskStatus.DATA_RECEIVED, label: "Data Received" },
  { key: OnboardingTaskStatus.SETUP_STARTED, label: "Setup Started" },
  { key: OnboardingTaskStatus.SETUP_COMPLETED, label: "Setup Completed" },
  { key: OnboardingTaskStatus.DELIVERED, label: "Delivered" },
];

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
    where: { companyId: ctx.companyId },
    orderBy: { updatedAt: "desc" },
    include: {
      lead: { select: { id: true, name: true, phone: true } },
      creator: { select: { id: true, name: true } },
    },
  });

  const byStage = new Map<OnboardingTaskStatus, typeof tasks>();
  for (const s of STAGES) byStage.set(s.key, []);

  for (const t of tasks) {
    const list = byStage.get(t.status);
    if (list) list.push(t);
    else byStage.get(OnboardingTaskStatus.NEW)!.push(t);
  }

  const queue = STAGES.map((s) => ({
    key: s.key,
    label: s.label,
    tasks: (byStage.get(s.key) ?? []).map((t) => ({
      id: t.id,
      status: t.status,
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
