import {
  CompanyBusinessType,
  CompanyIndustry,
  CompanyPlan,
  UserRole,
} from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import {
  getAuthUserFromToken,
  getTokenFromRequest,
  requireAuth,
  requireOnboardingLaunchSession,
} from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { loadMembershipsForJwt } from "@/lib/memberships-for-jwt";
import { prisma } from "@/lib/prisma";
import { setActiveCompanyCookie, setSessionCookie } from "@/lib/session-cookie";
import { signAccessToken } from "@/lib/jwt";
import { isSuperBossEmail } from "@/lib/super-boss";
import { runOnboardingLaunch } from "@/lib/onboarding-launch-engine";
import { normalizeMicroFranchisePhone } from "@/lib/micro-franchise-phone";

const bodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Company name is required")
      .max(200, "Company name is too long"),
    industry: z.nativeEnum(CompanyIndustry),
    businessType: z.nativeEnum(CompanyBusinessType).optional().default(CompanyBusinessType.SOLAR),
    plan: z.nativeEnum(CompanyPlan).optional(),
    logoUrl: z.string().max(2048).optional(),
    primaryColor: z.string().max(32).optional(),
    secondaryColor: z.string().max(32).optional(),
    companyEmail: z.union([z.literal(""), z.string().email().max(200)]).optional(),
    companyPhone: z.string().max(40).optional(),
    billingAddress: z.string().max(4000).optional(),
    gstNumber: z.string().max(32).optional(),
    bankDetails: z.string().max(4000).optional(),
    referralPhone: z.string().trim().max(32).optional(),
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

function jwtHasCompanyContext(u: NonNullable<ReturnType<typeof getAuthUserFromToken>>): boolean {
  return Boolean(u.companyId) || (u.memberships?.length ?? 0) > 0;
}

/**
 * @deprecated Use {@link POST /api/onboarding/launch}. This handler delegates to the shared launch engine.
 */
export async function POST(request: NextRequest) {
  try {
    const raw = await parseJsonBody(request);
    if (!raw.ok) return raw.response;

    const user = requireAuth(request);
    if (user instanceof NextResponse) return user;

    const parsed = bodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return zodValidationErrorResponse(parsed.error);
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
          deprecated: true as const,
          migrateTo: "/api/onboarding/launch" as const,
        });
        await setSessionCookie(res, newToken);
        await setActiveCompanyCookie(res, primary.companyId);
        return res;
      }
    }

    const {
      name,
      industry: industryRaw,
      businessType,
      plan: customPlan,
      logoUrl,
      primaryColor,
      secondaryColor,
      companyEmail,
      companyPhone,
      billingAddress,
      gstNumber,
      bankDetails,
      referralPhone,
    } = parsed.data;

    const industry =
      businessType === CompanyBusinessType.CUSTOM ? CompanyIndustry.CUSTOM : industryRaw;

    // get referral from request and pre-resolve MF partner for explicit link safety
    const referralPhoneRaw = referralPhone?.trim() || null;
    let microFranchisePartnerId: string | null = null;
    let referralPhoneForLaunch: string | null = referralPhoneRaw;
    if (referralPhoneRaw) {
      const normalized = normalizeMicroFranchisePhone(referralPhoneRaw);
      if (normalized) {
        referralPhoneForLaunch = normalized;
        const phoneCandidates =
          normalized.length === 10
            ? [normalized, `91${normalized}`]
            : [normalized];
        const partner = await prisma.microFranchisePartner.findFirst({
          where: { phone: { in: phoneCandidates } },
          select: { id: true },
        });
        if (partner) {
          microFranchisePartnerId = partner.id;
        }
      }
    }

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

    const actor = await requireOnboardingLaunchSession(request, [UserRole.ADMIN, UserRole.MANAGER]);
    if (actor instanceof NextResponse) return actor;

    const launchIndustry = industry === CompanyIndustry.CUSTOM ? "CUSTOM" : "SOLAR";

    const launch = await runOnboardingLaunch({
      ownerUserId: user.sub,
      ownerEmail: user.email,
      companyName: name,
      industry: launchIndustry,
      team: [],
      referralPhone: referralPhoneForLaunch,
      sessionId: null,
      addingAnotherBusiness: actor.addingAnotherBusiness,
      customWorkspacePlan:
        launchIndustry === "CUSTOM" ? (customPlan ?? CompanyPlan.PRO) : null,
      profile: {
        logoUrl: logoUrl ?? null,
        primaryColor,
        secondaryColor,
        companyEmail,
        companyPhone,
        billingAddress,
        gstNumber,
        bankDetails,
      },
    });

    if (!launch.ok) {
      return NextResponse.json(
        { ok: false as const, error: launch.error, code: launch.code },
        { status: launch.status ?? 400 },
      );
    }
    if (microFranchisePartnerId) {
      await prisma.company.updateMany({
        where: { id: launch.companyId, microFranchisePartnerId: null },
        data: { microFranchisePartnerId },
      });
    }

    const res = NextResponse.json({
      ok: true as const,
      companyId: launch.companyId,
      employeesCreated: launch.employeesCreated,
      dashboardsAssigned: launch.dashboardsAssigned,
      businessType: launch.businessType,
      deprecated: true as const,
      migrateTo: "/api/onboarding/launch" as const,
      ...(launch.requiresCustomPayment
        ? { requiresCustomPayment: true as const, nextStep: launch.nextStep }
        : {}),
      user: {
        id: user.sub,
        email: user.email,
        role: UserRole.ADMIN,
        companyId: launch.companyId,
        companyPlan: launchIndustry === "CUSTOM" ? (customPlan ?? CompanyPlan.PRO) : CompanyPlan.BASIC,
      },
    });

    await setSessionCookie(res, launch.sessionJwt);
    await setActiveCompanyCookie(res, launch.activeCompanyId);

    return res;
  } catch (error) {
    return handleApiError("POST /api/company/create", error);
  }
}
