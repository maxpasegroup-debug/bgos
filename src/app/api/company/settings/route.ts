import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import type { Prisma } from "@prisma/client";
import {
  companySettingsPatchSchema,
  sanitizeCompanySettingsPatch,
} from "@/lib/company-profile";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const settingsSelect = {
  id: true,
  name: true,
  plan: true,
  industry: true,
  logoUrl: true,
  primaryColor: true,
  secondaryColor: true,
  companyEmail: true,
  companyPhone: true,
  billingAddress: true,
  gstNumber: true,
  bankDetails: true,
  createdAt: true,
} as const;

/**
 * Full company profile for BGOS settings (admins only). Used for documents + branding.
 */
export async function GET(request: NextRequest) {
  const session = await requireAuthWithRoles(request, [
    UserRole.ADMIN,
    UserRole.MANAGER,
  ]);
  if (session instanceof NextResponse) return session;

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: {
      id: true,
      name: true,
      plan: true,
      industry: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
      companyEmail: true,
      companyPhone: true,
      billingAddress: true,
      gstNumber: true,
      bankDetails: true,
      createdAt: true,
    },
  });

  if (!company) {
    return NextResponse.json(
      { ok: false as const, error: "Company not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true as const,
    company,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuthWithRoles(request, [
    UserRole.ADMIN,
    UserRole.MANAGER,
  ]);
  if (session instanceof NextResponse) return session;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;

  const parsed = companySettingsPatchSchema.safeParse(raw.data);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }

  let updatePayload: Record<string, unknown>;
  try {
    updatePayload = sanitizeCompanySettingsPatch(parsed.data);
  } catch {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Logo must be an https URL or a path starting with /",
        code: "VALIDATION_ERROR" as const,
      },
      { status: 400 },
    );
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { ok: false as const, error: "No fields to update", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const updated = await prisma.company.update({
    where: { id: session.companyId },
    data: updatePayload as Prisma.CompanyUpdateInput,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: settingsSelect as any,
  });

  return NextResponse.json({ ok: true as const, company: updated });
}
