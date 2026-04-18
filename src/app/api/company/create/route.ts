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
import { applyBossCompanyAttributionFromSession } from "@/lib/nexa-boss-company-attribution";
import { runOnboardingLaunch } from "@/lib/onboarding-launch-engine";
import { normalizeMicroFranchisePhone } from "@/lib/micro-franchise-phone";
import type { LaunchIndustry } from "@/lib/company-launch-engine";

const bodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Company name is required")
      .max(200, "Company name is too long"),
    industry: z.preprocess((v) => {
      if (v === CompanyIndustry.SOLAR || v === CompanyIndustry.CUSTOM) return v;
      if (typeof v === "string") {
        const u = v.trim().toUpperCase();
        if (u === "SOLAR") return CompanyIndustry.SOLAR;
        if (u === "CUSTOM") return CompanyIndustry.CUSTOM;
      }
      return v;
    }, z.nativeEnum(CompanyIndustry)),
    businessType: z.preprocess((v) => {
      if (v === CompanyBusinessType.SOLAR || v === CompanyBusinessType.CUSTOM) return v;
      if (typeof v === "string" && v.trim() !== "") {
        const u = v.trim().toUpperCase();
        if (u === "SOLAR") return CompanyBusinessType.SOLAR;
        if (u === "CUSTOM") return CompanyBusinessType.CUSTOM;
      }
      return CompanyBusinessType.SOLAR;
    }, z.nativeEnum(CompanyBusinessType)),
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
    microFranchisePartnerId: z.string().trim().max(64).optional(),
    source: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const businessType = data.businessType;
    const industry = data.industry;
    if (businessType === CompanyBusinessType.CUSTOM) {
      if (!data.plan) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Choose a plan for your custom workspace.",
          path: ["plan"],
        });
      }
      if (industry !== CompanyIndustry.CUSTOM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Custom workspaces use the Custom industry (CUSTOM).",
          path: ["industry"],
        });
      }
    } else {
      if (industry === CompanyIndustry.CUSTOM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Solar workspaces cannot use the Custom industry.",
          path: ["industry"],
        });
      }
      if (industry !== CompanyIndustry.SOLAR) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Solar workspaces must use industry SOLAR.",
          path: ["industry"],
        });
      }
    }
  });

function jwtHasCompanyContext(u: NonNullable<ReturnType<typeof getAuthUserFromToken>>): boolean {
  return Boolean(u.companyId) || (u.memberships?.length ?? 0) > 0;
}

async function respondIdempotentExistingWorkspace(
  userSub: string,
  userEmail: string,
  companyId: string,
): Promise<NextResponse> {
  const u = await prisma.user.findUnique({
    where: { id: userSub },
    select: { workspaceActivatedAt: true, name: true, email: true },
  });
  const mems = await loadMembershipsForJwt(userSub);
  const jwtCompany = mems.find((m) => m.companyId === companyId) ?? mems[0];
  if (!jwtCompany) {
    console.error("[company/create] idempotent: no memberships for user", userSub);
    return NextResponse.json(
      {
        ok: false as const,
        error: "Workspace exists but memberships could not be loaded. Try /api/auth/refresh-session.",
        code: "MEMBERSHIP_LOAD_FAILED" as const,
      },
      { status: 500 },
    );
  }
  let newToken: string;
  try {
    newToken = signAccessToken({
      sub: userSub,
      email: userEmail,
      role: jwtCompany.jobRole,
      companyId: jwtCompany.companyId,
      companyPlan: jwtCompany.plan,
      workspaceReady: Boolean(u?.workspaceActivatedAt),
      memberships: mems,
      ...(isSuperBossEmail(userEmail) ? { superBoss: true as const } : {}),
    });
  } catch (e) {
    console.error("[company/create] idempotent signAccessToken failed", e);
    return NextResponse.json(
      {
        ok: false as const,
        error: "Authentication is not configured",
        code: "SERVER_ERROR" as const,
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  const res = NextResponse.json({
    ok: true as const,
    companyId,
    idempotent: true as const,
    message: "Workspace already exists — refreshed your session.",
    employeesCreated: 0,
    dashboardsAssigned: ["/bgos/dashboard"] as const,
    businessType: CompanyBusinessType.SOLAR,
    deprecated: true as const,
    migrateTo: "/api/onboarding/launch" as const,
    user: {
      id: userSub,
      email: userEmail,
      role: UserRole.ADMIN,
      companyId,
      companyPlan: jwtCompany.plan,
    },
  });
  await setSessionCookie(res, newToken);
  await setActiveCompanyCookie(res, companyId);
  return res;
}

/**
 * @deprecated Use {@link POST /api/onboarding/launch}. This handler delegates to the shared launch engine.
 */
export async function POST(request: NextRequest) {
  try {
    const raw = await parseJsonBody(request);
    if (!raw.ok) {
      console.error("[company/create] invalid JSON body", raw.response.status);
      return raw.response;
    }

    const user = requireAuth(request);
    if (user instanceof NextResponse) {
      console.error("[company/create] requireAuth failed", user.status);
      return user;
    }

    const parsed = bodySchema.safeParse(raw.data);
    if (!parsed.success) {
      console.error("[company/create] validation failed", parsed.error.flatten());
      return zodValidationErrorResponse(parsed.error);
    }

    const addBusinessIntent = request.headers.get("x-bgos-add-business") === "1";

    const token = getTokenFromRequest(request);
    const jwtOnly = token ? getAuthUserFromToken(token) : null;
    if (!jwtOnly) {
      console.error("[company/create] no valid JWT after requireAuth");
      return NextResponse.json(
        { ok: false as const, error: "Invalid session", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const data = parsed.data;
    const source = data.source?.trim() ?? "";

    if (source !== "NEXA_ENGINE") {
      return NextResponse.json(
        {
          ok: false as const,
          error: "Company creation is only allowed via Nexa onboarding (source: NEXA_ENGINE).",
          code: "NEXA_REQUIRED" as const,
        },
        { status: 403 },
      );
    }

    /** Idempotent: user already has a workspace and this is not “add another business”. */
    if (!addBusinessIntent) {
      const existingMembership = await prisma.userCompany.findFirst({
        where: { userId: user.sub },
        orderBy: { createdAt: "asc" },
        select: { companyId: true },
      });
      if (existingMembership) {
        console.warn("[company/create] idempotent return — user already has company", user.sub, existingMembership.companyId);
        return respondIdempotentExistingWorkspace(user.sub, user.email, existingMembership.companyId);
      }
    }

    if (!jwtHasCompanyContext(jwtOnly)) {
      const stale = await prisma.userCompany.findFirst({
        where: { userId: user.sub },
        orderBy: { createdAt: "asc" },
        include: { company: { select: { id: true, plan: true } } },
      });
      if (stale) {
        console.warn("[company/create] recovering stale JWT vs DB memberships", user.sub);
        return respondIdempotentExistingWorkspace(user.sub, user.email, stale.companyId);
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
      microFranchisePartnerId: mfPartnerIdFromBody,
      source: _src,
    } = data;

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

    const industry =
      businessType === CompanyBusinessType.CUSTOM ? CompanyIndustry.CUSTOM : industryRaw;

    const referralPhoneRaw = referralPhone?.trim() || null;
    let microFranchisePartnerId: string | null = null;
    let referralPhoneForLaunch: string | null = referralPhoneRaw;
    if (mfPartnerIdFromBody?.trim()) {
      microFranchisePartnerId = mfPartnerIdFromBody.trim();
    }
    if (referralPhoneRaw && !microFranchisePartnerId) {
      const normalized = normalizeMicroFranchisePhone(referralPhoneRaw);
      if (normalized) {
        referralPhoneForLaunch = normalized;
        const phoneCandidates =
          normalized.length === 10 ? [normalized, `91${normalized}`] : [normalized];
        const partner = await prisma.microFranchisePartner.findFirst({
          where: { phone: { in: phoneCandidates } },
          select: { id: true },
        });
        if (partner) {
          microFranchisePartnerId = partner.id;
        }
      }
    }

    const actor = await requireOnboardingLaunchSession(request, [UserRole.ADMIN, UserRole.MANAGER]);
    if (actor instanceof NextResponse) {
      console.error("[company/create] requireOnboardingLaunchSession rejected", actor.status);
      return actor;
    }

    const launchIndustry: LaunchIndustry =
      industry === CompanyIndustry.CUSTOM ? "CUSTOM" : "SOLAR";

    const launchInput = {
      ownerUserId: user.sub,
      ownerEmail: user.email,
      companyName: name,
      industry: launchIndustry,
      team: [] as [],
      referralPhone: referralPhoneForLaunch,
      sessionId: null as null,
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
    };

    let launch = await runOnboardingLaunch(launchInput);
    if (!launch.ok) {
      console.error("[company/create] runOnboardingLaunch failed (attempt 1)", {
        code: launch.code,
        error: launch.error,
        step: launch.step_failed,
      });
      /** Only retry transient engine failures; validation/forbidden are not retried. */
      const retryable = launch.code === "SERVER_ERROR";
      if (retryable) {
        await new Promise((r) => setTimeout(r, 400));
        launch = await runOnboardingLaunch(launchInput);
        if (!launch.ok) {
          console.error("[company/create] runOnboardingLaunch failed (attempt 2)", {
            code: launch.code,
            error: launch.error,
          });
        }
      }
    }

    if (!launch.ok) {
      return NextResponse.json(
        {
          ok: false as const,
          error: launch.error ?? "Company creation failed",
          code: launch.code ?? "LAUNCH_FAILED",
          step: launch.step_failed,
        },
        { status: launch.status ?? 400 },
      );
    }

    const onboardingSid = request.cookies.get("bgos_onboarding_sid")?.value?.trim() ?? null;
    try {
      await applyBossCompanyAttributionFromSession({
        onboardingSessionId: onboardingSid,
        newCompanyId: launch.companyId,
        bossUserId: user.sub,
      });
    } catch (e) {
      console.error("[company/create] attribution failed (non-fatal)", e);
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
    console.error("[company/create] unhandled error", error);
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[company/create] stack", stack);
    const inner = handleApiError("POST /api/company/create", error);
    /** Ensure JSON body with message when handleApiError returns generic 503 */
    if (inner.status === 503) {
      return NextResponse.json(
        {
          ok: false as const,
          error: message || "Could not complete the request",
          code: "SERVER_ERROR" as const,
        },
        { status: 500 },
      );
    }
    return inner;
  }
}
