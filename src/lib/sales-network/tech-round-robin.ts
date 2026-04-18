import type { Prisma, PrismaClient } from "@prisma/client";
import { SalesNetworkRole, TechQueueStatus, UserRole } from "@prisma/client";

/**
 * Pick next tech_exec for round-robin from company memberships.
 * Persists cursor in {@link TechRoundRobinState}.
 */
export async function assignTechExecRoundRobin(
  db: PrismaClient | Prisma.TransactionClient,
  companyId: string,
): Promise<string | null> {
  const raw = await db.userCompany.findMany({
    where: {
      companyId,
      OR: [
        { salesNetworkRole: SalesNetworkRole.TECH_EXEC },
        { jobRole: UserRole.TECH_EXECUTIVE },
      ],
      archivedAt: null,
    },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  const seen = new Set<string>();
  const techUsers = raw.filter((r) => {
    if (seen.has(r.userId)) return false;
    seen.add(r.userId);
    return true;
  });
  if (techUsers.length === 0) return null;

  const state = await db.techRoundRobinState.upsert({
    where: { companyId },
    create: { companyId, position: 0 },
    update: {},
  });

  const idx = state.position % techUsers.length;
  const picked = techUsers[idx]!.userId;
  const nextPos = (state.position + 1) % Math.max(techUsers.length, 1);

  await db.techRoundRobinState.update({
    where: { companyId },
    data: { lastAssignedUserId: picked, position: nextPos },
  });

  return picked;
}

export async function enqueueTechRequest(
  db: PrismaClient | Prisma.TransactionClient,
  companyId: string,
  requestId: string,
): Promise<{ entryId: string; assignedToUserId: string | null }> {
  const assignedToUserId = await assignTechExecRoundRobin(db, companyId);
  const entry = await db.techQueueEntry.create({
    data: {
      companyId,
      requestId,
      assignedToUserId,
      status: assignedToUserId ? TechQueueStatus.ASSIGNED : TechQueueStatus.PENDING,
    },
  });
  return { entryId: entry.id, assignedToUserId };
}
