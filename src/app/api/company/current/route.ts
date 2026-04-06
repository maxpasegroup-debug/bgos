import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithCompany } from "@/lib/auth";
import { companyCurrentApiSelect, type CompanyCurrentApiRow } from "@/lib/company-db-select";
import { prisma } from "@/lib/prisma";

/**
 * Active company profile + branding (from session JWT + activeCompanyId cookie).
 */
export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const company = (await prisma.company.findUnique({
    where: { id: session.companyId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: companyCurrentApiSelect as any,
  })) as CompanyCurrentApiRow | null;

  if (!company) {
    return NextResponse.json(
      { ok: false as const, error: "Company not found", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true as const,
    company: {
      name: company.name,
      logoUrl: company.logoUrl,
      primaryColor: company.primaryColor,
      secondaryColor: company.secondaryColor,
      companyEmail: company.companyEmail,
      companyPhone: company.companyPhone,
      billingAddress: company.billingAddress,
      gstNumber: company.gstNumber,
    },
  });
}
