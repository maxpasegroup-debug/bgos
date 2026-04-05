import "server-only";

import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

/** Roles allowed to create/update/reset-password for users in their company. */
export const USER_MUTATION_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];

export async function findUserInCompany(id: string, companyId: string) {
  return prisma.user.findFirst({
    where: { id, companyId },
  });
}
