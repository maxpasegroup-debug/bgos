import { UserRole } from "@prisma/client";

/**
 * Company boss with an active company — use instead of needsOnboarding / workspace flags for routing.
 * ADMIN + companyId ⇒ never send through first-time onboarding again.
 */
export function isBossReady(
  role: string | null | undefined,
  companyId: string | null | undefined,
): boolean {
  if (role !== UserRole.ADMIN && role !== "ADMIN") return false;
  if (companyId == null || typeof companyId !== "string") return false;
  return companyId.length > 0;
}
