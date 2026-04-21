import { IncentiveAudience, UserRole } from "@prisma/client";

/** Which announcement audiences apply to this user's role (ICECONNECT + MF). */
export function incentiveAudiencesForRole(role: UserRole): IncentiveAudience[] {
  if (role === UserRole.BDM || role === UserRole.MANAGER) {
    return [IncentiveAudience.SALES, IncentiveAudience.BOTH, IncentiveAudience.NICEJOBS];
  }
  return [
    IncentiveAudience.SALES,
    IncentiveAudience.FRANCHISE,
    IncentiveAudience.BOTH,
    IncentiveAudience.NICEJOBS,
  ];
}
