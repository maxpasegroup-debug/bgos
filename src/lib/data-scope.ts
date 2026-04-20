import "server-only";

/**
 * Multi-tenant data isolation: every query for tenant-owned rows (leads, deals, operations,
 * services, inventory, accounts, etc.) must include `where: { companyId }` (or equivalent join)
 * derived from the active workspace. Never rely on user id alone for row visibility.
 */
export function assertCompanyScope(companyId: string | null | undefined): asserts companyId is string {
  if (companyId == null || companyId === "") {
    throw new Error("Missing company scope for tenant query");
  }
}
