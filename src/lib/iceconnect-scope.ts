import "server-only";

import type { UserRole } from "@prisma/client";
import type { AuthUser } from "./auth";

const PRIVILEGED = new Set<UserRole>(["ADMIN", "MANAGER"]);

export function isIceconnectPrivileged(role: UserRole): boolean {
  return PRIVILEGED.has(role);
}

/**
 * Sales / engineer / installer: restrict to rows assigned to this user unless privileged.
 */
export function assigneeFilter(session: AuthUser): { assignedTo: string } | Record<string, never> {
  if (isIceconnectPrivileged(session.role)) return {};
  return { assignedTo: session.sub };
}
