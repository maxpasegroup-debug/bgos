import "server-only";

import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

/** Only company ADMIN may manage employees (create / update / list / reset password). */
export const USER_ADMIN_ROLES: UserRole[] = [UserRole.ADMIN];

export async function findUserInCompany(id: string, companyId: string) {
  return prisma.user.findFirst({
    where: { id, companyId },
  });
}

export function toPublicUser(u: {
  id: string;
  name: string;
  mobile: string;
  email: string;
  role: UserRole;
  companyId: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: u.id,
    name: u.name,
    mobile: u.mobile,
    email: u.email,
    role: u.role,
    companyId: u.companyId,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
