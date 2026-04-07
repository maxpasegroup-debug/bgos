import { UserRole } from "@prisma/client";

export const HR_MANAGER_ROLES: UserRole[] = [
  UserRole.HR_MANAGER,
  UserRole.ADMIN,
  UserRole.MANAGER,
];

export function isHrManagerRole(role: UserRole): boolean {
  return HR_MANAGER_ROLES.includes(role);
}

export function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
