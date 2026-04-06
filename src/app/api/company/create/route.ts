import { CompanyIndustry, CompanyPlan, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { getAuthUserFromToken, getAuthUser, getTokenFromRequest, requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { applyIndustryTemplate } from "@/lib/industry-templates";
import { createLogger } from "@/lib/logger";
import { loadMembershipsForJwt } from "@/lib/memberships-for-jwt";
import { prisma } from "@/lib/prisma";
import { setActiveCompanyCookie, setSessionCookie } from "@/lib/session-cookie";
import { signAccessToken } from "@/lib/jwt";
import { normalizeLogoUrl } from "@/lib/company-profile";
import { companyMembershipClass } from "@/lib/user-company";

const bodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(200, "Company name is too long"),
  industry: z.nativeEnum(CompanyIndustry),
  logoUrl: z.string().max(2048).optional(),
  primaryColor: z.string().max(32).optional(),
  secondaryColor: z.string().max(32).optional(),
  companyEmail: z.union([z.literal(""), z.string().email().max(200)]).optional(),
  companyPhone: z.string().max(40).optional(),
  billingAddress: z.string().max(4000).optional(),
  gstNumber: z.string().max(32).optional(),
  bankDetails: z.string().max(4000).optional(),
});

function jwtHasCompanyContext(
  u: NonNullable<ReturnType<typeof getAuthUserFromToken>>,
): boolean {
  return Boolean(u.companyId) || (u.memberships?.length ?? 0) > 0;
}

export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  const token = getTokenFromRequest(request);
  const jwtOnly = token ? getAuthUserFromToken(token) : null;
  if (!jwtOnly) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid session", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (!jwtHasCompanyContext(jwtOnly)) {
    const stale = await prisma.userCompany.findFirst({
      where: { userId: session.sub },
      orderBy: { createdAt: "asc" },
      include: { company: { select: { id: true, plan: true } } },
    });
    if (stale) {
      const u = await prisma.user.findUnique({
        where: { id: session.sub },
        select: { workspaceActivatedAt: true },
      });
      const mems = await loadMembershipsForJwt(session.sub);
      const primary = mems[0]!;
      let newToken: string;
      try {
        newToken = signAccessToken({
          sub: session.sub,
          email: session.email,
          role: primary.jobRole,
          companyId: primary.companyId,
          companyPlan: primary.plan,
          workspaceReady: Boolean(u?.workspaceActivatedAt),
          memberships: mems,
        });
      } catch {
        return NextResponse.json(
          { ok: false as const, error: "Authentication is not configured", code: "SERVER_ERROR" },
          { status: 500 },
        );
      }
      const res = NextResponse.json({
        ok: true as const,
        companyId: stale.companyId,
        recovered: true as const,
      });
      setSessionCookie(res, newToken);
      setActiveCompanyCookie(res, primary.companyId);
      return res;
    }
  }

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;

  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }

  const {
    name,
    industry,
    logoUrl: logoIn,
    primaryColor,
    secondaryColor,
    companyEmail,
    companyPhone,
    billingAddress,
    gstNumber,
    bankDetails,
  } = parsed.data;

  let logoUrl: string | null = null;
  if (logoIn != null && logoIn.trim() !== "") {
    try {
      logoUrl = normalizeLogoUrl(logoIn);
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
  }

  const addingAnotherBusiness = jwtHasCompanyContext(jwtOnly);

  if (addingAnotherBusiness) {
    if (!session.workspaceReady) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "Complete workspace activation before creating another company",
          code: "WORKSPACE_NOT_ACTIVATED" as const,
        },
        { status: 403 },
      );
    }
    if (session.role !== UserRole.ADMIN && session.role !== UserRole.MANAGER) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "Only workspace admins can create a company",
          code: "FORBIDDEN" as const,
        },
        { status: 403 },
      );
    }
    const owner = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { workspaceActivatedAt: true },
    });
    if (!owner?.workspaceActivatedAt) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "Complete workspace activation first",
          code: "WORKSPACE_NOT_ACTIVATED" as const,
        },
        { status: 403 },
      );
    }
  }

  let companyId: string;
  try {
    const row = await prisma.$transaction(async (tx) => {
      const co = await tx.company.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          name,
          industry,
          plan: CompanyPlan.BASIC,
          ownerId: session.sub,
          ...(logoUrl != null ? { logoUrl } : {}),
          ...(primaryColor?.trim() ? { primaryColor: primaryColor.trim() } : {}),
          ...(secondaryColor?.trim() ? { secondaryColor: secondaryColor.trim() } : {}),
          ...(companyEmail?.trim() ? { companyEmail: companyEmail.trim() } : {}),
          ...(companyPhone?.trim() ? { companyPhone: companyPhone.trim() } : {}),
          ...(billingAddress?.trim() ? { billingAddress: billingAddress.trim() } : {}),
          ...(gstNumber?.trim() ? { gstNumber: gstNumber.trim().toUpperCase() } : {}),
          ...(bankDetails?.trim() ? { bankDetails: bankDetails.trim() } : {}),
        } as any,
      });
      await tx.userCompany.create({
        data: {
          userId: session.sub,
          companyId: co.id,
          role: companyMembershipClass(UserRole.ADMIN),
          jobRole: UserRole.ADMIN,
        },
      });
      return co;
    });
    companyId = row.id;
  } catch (e) {
    return handleApiError("POST /api/company/create", e);
  }

  if (industry === CompanyIndustry.SOLAR) {
    try {
      await applyIndustryTemplate(companyId, "SOLAR");
    } catch (e) {
      createLogger("company/create").error("applyIndustryTemplate failed", e, { companyId });
    }
  }

  const mems = await loadMembershipsForJwt(session.sub);
  const primary = mems[0]!;
  const jwtCompany = mems.find((m) => m.companyId === companyId) ?? primary;
  const workspaceReady = addingAnotherBusiness;

  let newToken: string;
  try {
    newToken = signAccessToken({
      sub: session.sub,
      email: session.email,
      role: jwtCompany.jobRole,
      companyId: jwtCompany.companyId,
      companyPlan: jwtCompany.plan,
      workspaceReady,
      memberships: mems,
    });
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Authentication is not configured", code: "SERVER_ERROR" },
      { status: 500 },
    );
  }

  const res = NextResponse.json({
    ok: true as const,
    companyId,
    user: {
      id: session.sub,
      email: session.email,
      role: UserRole.ADMIN,
      companyId,
      companyPlan: CompanyPlan.BASIC,
    },
  });

  setSessionCookie(res, newToken);
  setActiveCompanyCookie(res, companyId);

  return res;
}
