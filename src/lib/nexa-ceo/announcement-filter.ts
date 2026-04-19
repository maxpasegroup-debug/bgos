import type { NexaAnnouncement, UserRole } from "@prisma/client";

export function announcementVisibleForMember(
  row: Pick<NexaAnnouncement, "scope" | "targetRoles" | "targetRegions" | "expiresAt">,
  jobRole: UserRole,
  region: string | null,
): boolean {
  if (row.expiresAt && row.expiresAt < new Date()) return false;
  if (row.scope === "ALL") return true;
  if (row.scope === "ROLES") {
    const roles = row.targetRoles as unknown;
    if (!Array.isArray(roles) || roles.length === 0) return true;
    return roles.some((r) => r === jobRole);
  }
  if (row.scope === "REGIONS") {
    const regs = row.targetRegions as unknown;
    if (!Array.isArray(regs) || regs.length === 0) return true;
    if (!region) return false;
    return regs.some((r) => r === region);
  }
  return true;
}
