import "server-only";

/**
 * Standard Prisma `where` fragment for models owned by a company (`companyId` FK).
 * Tenant APIs should always combine this (or equivalent) with other predicates so rows
 * from other companies are never returned or mutated.
 */
export function whereCompany(companyId: string): { companyId: string } {
  return { companyId };
}
