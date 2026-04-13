import {
  CompanyBusinessType,
  CompanyIndustry,
  CompanyPlan,
  CompanySubscriptionStatus,
  UserRole,
} from "@prisma/client";
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
import { trialEndDateFromStart } from "@/lib/trial";
import { isSuperBossEmail } from "@/lib/super-boss";

const bodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Company name is required")
      .max(200, "Company name is too long"),
    industry: z.nativeEnum(CompanyIndustry),
    businessType: z.nativeEnum(CompanyBusinessType).optional().default(CompanyBusinessType.SOLAR),
    /** Required when {@link businessType} is CUSTOM (Basic / Pro / Enterprise paid build). */
    plan: z.nativeEnum(CompanyPlan).optional(),
    logoUrl: z.string().max(2048).optional(),
    primaryColor: z.string().max(32).optional(),
    secondaryColor: z.string().max(32).optional(),
    companyEmail: z.union([z.literal(""), z.string().email().max(200)]).optional(),
    companyPhone: z.string().max(40).optional(),
    billingAddress: z.string().max(4000).optional(),
    gstNumber: z.string().max(32).optional(),
    bankDetails: z.string().max(4000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.businessType === CompanyBusinessType.CUSTOM) {
      if (!data.plan) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Choose a plan for your custom workspace.",
          path: ["plan"],
        });
      }
      if (data.industry !== CompanyIndustry.CUSTOM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Custom workspaces use the Custom industry.",
          path: ["industry"],
        });
      }
    } else {
      if (data.industry === CompanyIndustry.CUSTOM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Solar workspaces cannot use the Custom industry.",
          path: ["industry"],
        });
      }
      if (data.industry !== CompanyIndustry.SOLAR) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Solar workspaces use the Solar industry.",
          path: ["industry"],
        });
      }
    }
  });

function jwtHasCompanyContext(
  u: NonNullable<ReturnType<typeof getAuthUserFromToken>>,
): boolean {
  return Boolean(u.companyId) || (u.memberships?.length ?? 0) > 0;
}

async function getCurrentUser(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return null;
  return session;
}

export async function POST(request: NextRequest) {
  try {
    const raw = await parseJsonBody(request);
    if (!raw.ok) return raw.response;
    const body = raw.data;
    console.log("ONBOARD INPUT:", body);

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false as const, message: "Unauthorized" },
        { status: 401 },
      );
    }
    console.log("USER:", user.sub);

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return zodValidationErrorResponse(parsed.error);
    }
    if (!parsed.data.name.trim()) {
      return NextResponse.json(
        { success: false as const, message: "companyName must not be empty" },
        { status: 400 },
      );
    }

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
        where: { userId: user.sub },
        orderBy: { createdAt: "asc" },
        include: { company: { select: { id: true, plan: true } } },
      });
      if (stale) {
        const u = await prisma.user.findUnique({
          where: { id: user.sub },
          select: { workspaceActivatedAt: true },
        });
        const mems = await loadMembershipsForJwt(user.sub);
        const primary = mems[0]!;
        let newToken: string;
        try {
          newToken = signAccessToken({
            sub: user.sub,
            email: user.email,
            role: primary.jobRole,
            companyId: primary.companyId,
            companyPlan: primary.plan,
            workspaceReady: Boolean(u?.workspaceActivatedAt),
            memberships: mems,
            ...(isSuperBossEmail(user.email) ? { superBoss: true as const } : {}),
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

    const {
      name,
      industry: industryRaw,
      businessType,
      plan: customPlan,
      logoUrl: logoIn,
      primaryColor,
      secondaryColor,
      companyEmail,
      companyPhone,
      billingAddress,
      gstNumber,
      bankDetails,
    } = parsed.data;

    const industry =
      businessType === CompanyBusinessType.CUSTOM ? CompanyIndustry.CUSTOM : industryRaw;

    const addingAnotherBusiness = jwtHasCompanyContext(jwtOnly);

    if (businessType === CompanyBusinessType.CUSTOM && addingAnotherBusiness) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "Custom build onboarding is only for your first workspace.",
          code: "CUSTOM_NOT_ALLOWED" as const,
        },
        { status: 400 },
      );
    }

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

    if (addingAnotherBusiness) {
      if (!user.workspaceReady) {
        return NextResponse.json(
          {
            ok: false as const,
            error: "Complete workspace activation before creating another company",
            code: "WORKSPACE_NOT_ACTIVATED" as const,
          },
          { status: 403 },
        );
      }
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
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
        where: { id: user.sub },
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

    const existingByOwnerAndName = await prisma.company.findFirst({
      where: { ownerId: user.sub, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingByOwnerAndName) {
      const mems = await loadMembershipsForJwt(user.sub);
      const primary = mems[0]!;
      const jwtCompany = mems.find((m) => m.companyId === existingByOwnerAndName.id) ?? primary;
      const newToken = signAccessToken({
        sub: user.sub,
        email: user.email,
        role: jwtCompany.jobRole,
        companyId: jwtCompany.companyId,
        companyPlan: jwtCompany.plan,
        workspaceReady: addingAnotherBusiness,
        memberships: mems,
        ...(isSuperBossEmail(user.email) ? { superBoss: true as const } : {}),
      });
      const res = NextResponse.json({
        ok: true as const,
        companyId: existingByOwnerAndName.id,
        existing: true as const,
      });
      setSessionCookie(res, newToken);
      setActiveCompanyCookie(res, existingByOwnerAndName.id);
      return res;
    }

    let companyId: string;
    const row = await prisma.$transaction(async (tx) => {
      if (businessType === CompanyBusinessType.CUSTOM) {
        const pl = customPlan!;
        const co = await tx.company.create({
          data: {
            name,
            industry,
            businessType: CompanyBusinessType.CUSTOM,
            plan: pl,
            ownerId: user.sub,
            trialStartDate: null,
            trialEndDate: null,
            isTrialActive: false,
            subscriptionStatus: CompanySubscriptionStatus.PAYMENT_PENDING,
            ...(logoUrl != null ? { logoUrl } : {}),
            ...(primaryColor?.trim() ? { primaryColor: primaryColor.trim() } : {}),
            ...(secondaryColor?.trim() ? { secondaryColor: secondaryColor.trim() } : {}),
            ...(companyEmail?.trim() ? { companyEmail: companyEmail.trim() } : {}),
            ...(companyPhone?.trim() ? { companyPhone: companyPhone.trim() } : {}),
            ...(billingAddress?.trim() ? { billingAddress: billingAddress.trim() } : {}),
            ...(gstNumber?.trim() ? { gstNumber: gstNumber.trim().toUpperCase() } : {}),
            ...(bankDetails?.trim() ? { bankDetails: bankDetails.trim() } : {}),
          },
        });
        await tx.userCompany.create({
          data: {
            userId: user.sub,
            companyId: co.id,
            role: companyMembershipClass(UserRole.ADMIN),
            jobRole: UserRole.ADMIN,
          },
        });
        return co;
      }

      const trialStartDate = new Date();
      const co = await tx.company.create({
        data: {
          name,
          industry,
          businessType: CompanyBusinessType.SOLAR,
          plan: CompanyPlan.BASIC,
          ownerId: user.sub,
          trialStartDate,
          trialEndDate: trialEndDateFromStart(trialStartDate),
          isTrialActive: true,
          subscriptionStatus: CompanySubscriptionStatus.TRIAL,
          ...(logoUrl != null ? { logoUrl } : {}),
          ...(primaryColor?.trim() ? { primaryColor: primaryColor.trim() } : {}),
          ...(secondaryColor?.trim() ? { secondaryColor: secondaryColor.trim() } : {}),
          ...(companyEmail?.trim() ? { companyEmail: companyEmail.trim() } : {}),
          ...(companyPhone?.trim() ? { companyPhone: companyPhone.trim() } : {}),
          ...(billingAddress?.trim() ? { billingAddress: billingAddress.trim() } : {}),
          ...(gstNumber?.trim() ? { gstNumber: gstNumber.trim().toUpperCase() } : {}),
          ...(bankDetails?.trim() ? { bankDetails: bankDetails.trim() } : {}),
        },
      });
      await tx.userCompany.create({
        data: {
          userId: user.sub,
          companyId: co.id,
          role: companyMembershipClass(UserRole.ADMIN),
          jobRole: UserRole.ADMIN,
        },
      });
      return co;
    });
    companyId = row.id;

    try {
      await applyIndustryTemplate(companyId, industry === CompanyIndustry.SOLAR ? "SOLAR" : "CUSTOM");
    } catch (e) {
      createLogger("company/create").error("applyIndustryTemplate failed", e, { companyId });
    }

    const mems = await loadMembershipsForJwt(user.sub);
    const primary = mems[0]!;
    const jwtCompany = mems.find((m) => m.companyId === companyId) ?? primary;
    const workspaceReady = addingAnotherBusiness;

    let newToken: string;
    try {
      newToken = signAccessToken({
        sub: user.sub,
        email: user.email,
        role: jwtCompany.jobRole,
        companyId: jwtCompany.companyId,
        companyPlan: jwtCompany.plan,
        workspaceReady,
        memberships: mems,
        ...(isSuperBossEmail(user.email) ? { superBoss: true as const } : {}),
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
      businessType,
      ...(businessType === CompanyBusinessType.CUSTOM
        ? { requiresCustomPayment: true as const, nextStep: "/onboarding/custom/pay" as const }
        : {}),
      user: {
        id: user.sub,
        email: user.email,
        role: UserRole.ADMIN,
        companyId,
        companyPlan: row.plan,
      },
    });

    setSessionCookie(res, newToken);
    setActiveCompanyCookie(res, companyId);

    return res;
  } catch (error) {
    const e = error as Error;
    return NextResponse.json(
      {
        success: false as const,
        message: e?.message || "Onboarding failed",
      },
      { status: 500 },
    );
  }
}
