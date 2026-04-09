/**
 * Select shapes for Company after branding + business-profile migrations.
 * After pulling schema changes, run `npm run db:generate` so Prisma types align.
 */
export const companyCurrentApiSelect = {
  name: true,
  logoUrl: true,
  primaryColor: true,
  secondaryColor: true,
  companyEmail: true,
  companyPhone: true,
  billingAddress: true,
  gstNumber: true,
  bankDetails: true,
} as const;

export type CompanyCurrentApiRow = {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  billingAddress: string | null;
  gstNumber: string | null;
  bankDetails: string | null;
};
