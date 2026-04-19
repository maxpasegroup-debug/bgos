import { UserRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

const BOSS_VIEW_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SALES_HEAD,
];

/**
 * Viewer may load another user’s Nexa plan only when same company and
 * self, company owner, HR-style role, or direct sales parent.
 */
export async function canViewUserNexaPlan(
  prisma: PrismaClient,
  companyId: string,
  viewerId: string,
  targetUserId: string,
): Promise<boolean> {
  if (viewerId === targetUserId) return true;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { ownerId: true },
  });
  if (company?.ownerId === viewerId) return true;

  const viewer = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: viewerId, companyId } },
    select: { jobRole: true },
  });
  if (viewer && BOSS_VIEW_ROLES.includes(viewer.jobRole)) return true;

  const asParent = await prisma.userCompany.findFirst({
    where: {
      companyId,
      userId: targetUserId,
      parentUserId: viewerId,
      archivedAt: null,
    },
    select: { id: true },
  });
  return !!asParent;
}
