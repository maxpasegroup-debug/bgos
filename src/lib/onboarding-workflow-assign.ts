import "server-only";

import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** TECH_HEAD + TECH_EXECUTIVE only (workflow spec). */
export async function listWorkflowTechUserIds(companyId: string): Promise<string[]> {
  const rows = await prisma.userCompany.findMany({
    where: {
      companyId,
      jobRole: { in: [UserRole.TECH_HEAD, UserRole.TECH_EXECUTIVE] },
    },
    include: { user: { select: { isActive: true } } },
  });
  return rows
    .filter((r) => r.user.isActive)
    .map((r) => r.userId)
    .sort();
}

export async function pickNextTechUserId(
  submissionCompanyId: string,
  options?: { techPoolCompanyId?: string | null },
): Promise<string | null> {
  const poolId =
    options?.techPoolCompanyId && options.techPoolCompanyId.length > 0
      ? options.techPoolCompanyId
      : submissionCompanyId;

  const ids = await listWorkflowTechUserIds(poolId);
  if (ids.length === 0) return null;

  const co = await prisma.company.findUnique({
    where: { id: poolId },
    select: { internalWorkflowLastTechUserId: true },
  });
  const last = co?.internalWorkflowLastTechUserId;
  let idx = last ? ids.indexOf(last) : -1;
  if (idx < 0) idx = -1;
  const next = ids[(idx + 1) % ids.length] ?? null;
  if (!next) return null;

  await prisma.company.update({
    where: { id: poolId },
    data: { internalWorkflowLastTechUserId: next },
  });
  return next;
}
