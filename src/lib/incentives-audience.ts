import { IncentiveAudience, UserRole } from "@prisma/client";

/** Which announcement audiences apply to this user's role (ICECONNECT + MF). */
export function incentiveAudiencesForRole(role: UserRole): IncentiveAudience[] {
  if (role === UserRole.MICRO_FRANCHISE) {
    return [IncentiveAudience.FRANCHISE, IncentiveAudience.BOTH, IncentiveAudience.NICEJOBS];
  }
  if (
    role === UserRole.SALES_EXECUTIVE ||
    role === UserRole.TELECALLER ||
    role === UserRole.SALES_HEAD ||
    role === UserRole.MANAGER
  ) {
    return [IncentiveAudience.SALES, IncentiveAudience.BOTH, IncentiveAudience.NICEJOBS];
  }
  return [
    IncentiveAudience.SALES,
    IncentiveAudience.FRANCHISE,
    IncentiveAudience.BOTH,
    IncentiveAudience.NICEJOBS,
  ];
}
