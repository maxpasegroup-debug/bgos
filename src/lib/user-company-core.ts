import { UserRole } from "@prisma/client";
import type { UserCompany } from "@prisma/client";

/** Company admins who may manage users in that workspace. */
export const USER_ADMIN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];

/** Company-level `UserCompany.role` string from operational job role. */
export function companyMembershipClass(jobRole: UserRole): "ADMIN" | "EMPLOYEE" {
  return jobRole === UserRole.ADMIN || jobRole === UserRole.MANAGER
    ? "ADMIN"
    : "EMPLOYEE";
}

export function toPublicUser(
  u: {
    id: string;
    name: string;
    mobile: string | null;
    email: string;
    isActive: boolean;
    createdAt: Date;
  },
  m: Pick<UserCompany, "companyId" | "jobRole">,
) {
  return {
    id: u.id,
    name: u.name,
    mobile: u.mobile ?? "",
    email: u.email,
    role: m.jobRole,
    companyId: m.companyId,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
