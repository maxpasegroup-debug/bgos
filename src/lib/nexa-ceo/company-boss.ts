import { UserRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

/**
 * Company owner or workspace admin — can launch competitions, announcements, welfare notes.
 */
export async function canManageCompanyPrograms(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { ownerId: true },
  });
  if (company?.ownerId === userId) return true;
  const uc = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { jobRole: true },
  });
  return uc?.jobRole === UserRole.ADMIN;
}
